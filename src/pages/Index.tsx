import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast"; // Using shadcn toast hook
import { showSuccess, showError } from "@/utils/toast"; // Using sonner utility
import { User, Users, Play, StopCircle, History, Trash2, ChevronDown, ChevronUp } from "lucide-react"; // Icons

// Define types for clarity
interface Client {
  id: string;
  name: string;
}

interface GiroState {
  giroAttivo: boolean;
  giroStartTime: number | null;
  giroOraPartenza: string | null;
  giroFattorino: string | null;
  giroClienti: string[];
}

interface GiroSummary {
  id: number;
  date: string;
  fattorino: string | null;
  duration: string;
  numClients: number;
  clients: string[];
  startTime: string | null;
  endTime: string;
}


// Helper function to format time
const formatTime = (totalSeconds: number): string => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (num: number) => num.toString().padStart(2, '0');

  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
};

const DeliveryManager = () => {
  const { toast } = useToast(); // Shadcn toast for basic notifications (can be replaced by sonner if preferred)

  // State for Fattorino Name
  const [fattorinoName, setFattorinoName] = useState<string>("");
  const [isEditingFattorino, setIsEditingFattorino] = useState<boolean>(true);

  // State for Clients
  const [clients, setClients] = useState<Client[]>([{ id: Date.now().toString(), name: "" }]);

  // State for Giro
  const [giroState, setGiroState] = useState<GiroState>({
    giroAttivo: false,
    giroStartTime: null,
    giroOraPartenza: null,
    giroFattorino: null,
    giroClienti: [],
  });

  // State for Timer
  const [elapsedTime, setElapsedTime] = useState<number>(0);

  // State for History (Optional V1)
  const [history, setHistory] = useState<GiroSummary[]>([]); // Using the defined type
  const [expandedHistoryItem, setExpandedHistoryItem] = useState<number | null>(null); // State to track expanded item


  // --- Effects ---

  // Load state from localStorage on mount
  useEffect(() => {
    const savedFattorino = localStorage.getItem("fattorinoName");
    if (savedFattorino) {
      setFattorinoName(savedFattorino);
      setIsEditingFattorino(false);
    }

    const savedGiroState = localStorage.getItem("giroState");
    if (savedGiroState) {
      const parsedState: GiroState = JSON.parse(savedGiroState);
      setGiroState(parsedState);
      if (parsedState.giroAttivo && parsedState.giroStartTime !== null) {
        // Calculate initial elapsed time based on saved start time
        const initialElapsedTime = Math.floor((Date.now() - parsedState.giroStartTime) / 1000);
        setElapsedTime(initialElapsedTime);
      }
    }

    const savedHistory = localStorage.getItem("giroHistory");
    if (savedHistory) {
      setHistory(JSON.parse(savedHistory));
    }
  }, []);

  // Timer effect
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (giroState.giroAttivo && giroState.giroStartTime !== null) {
      timer = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - giroState.giroStartTime!) / 1000));
      }, 1000);
    } else if (timer) {
      clearInterval(timer);
    }

    // Cleanup on unmount or when giro ends
    return () => {
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [giroState.giroAttivo, giroState.giroStartTime]);

  // Save giro state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("giroState", JSON.stringify(giroState));
  }, [giroState]);

  // Save history to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("giroHistory", JSON.stringify(history));
  }, [history]);


  // --- Handlers ---

  // Fattorino Handlers
  const handleSaveFattorino = () => {
    if (!fattorinoName.trim()) {
      showError("Inserisci un nome per il fattorino");
      return;
    }
    localStorage.setItem("fattorinoName", fattorinoName.trim());
    setIsEditingFattorino(false);
    showSuccess("Nome fattorino salvato!");
  };

  const handleEditFattorino = () => {
    setIsEditingFattorino(true);
  };

  // Client Handlers
  const handleAddClient = () => {
    setClients([...clients, { id: Date.now().toString(), name: "" }]);
  };

  const handleClientNameChange = (id: string, name: string) => {
    setClients(clients.map(client => client.id === id ? { ...client, name } : client));
  };

  const handleRemoveClient = (id: string) => {
    setClients(clients.filter(client => client.id !== id));
  };

  const handleResetClients = () => {
    setClients([{ id: Date.now().toString(), name: "" }]);
  };

  // Giro Handlers
  const handleStartGiro = () => {
    if (!fattorinoName.trim()) {
      showError("Salva prima il nome del fattorino");
      return;
    }

    const activeClients = clients.map(c => c.name.trim()).filter(name => name !== "");
    if (activeClients.length === 0) {
      showError("Inserisci almeno un cliente");
      return;
    }

    const startTime = Date.now();
    const startDate = new Date(startTime);
    const oraPartenzaFormattata = `${startDate.toLocaleDateString()} ${startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

    const newGiroState: GiroState = {
      giroAttivo: true,
      giroStartTime: startTime,
      giroOraPartenza: oraPartenzaFormattata,
      giroFattorino: fattorinoName.trim(),
      giroClienti: activeClients,
    };

    setGiroState(newGiroState);
    setElapsedTime(0); // Reset timer display, it will start counting from 0 based on new startTime

    // Prepare and send WhatsApp message
    const waMessage = `INIZIO GIRO CONSEGNE\n\nFattorino: ${newGiroState.giroFattorino}\nData e Ora Partenza: ${newGiroState.giroOraPartenza}\n\nClienti da servire:\n${newGiroState.giroClienti.map(c => `- ${c}`).join('\n')}`;
    const encodedMessage = encodeURIComponent(waMessage);
    const waLink = `https://wa.me/393939393799?text=${encodedMessage}`;

    window.open(waLink, '_blank');

    showSuccess("Giro consegne iniziato!");
  };

  const handleEndGiro = () => {
    if (giroState.giroStartTime === null) {
      showError("Errore: Nessun giro attivo da concludere.");
      return;
    }

    const endTime = Date.now();
    const durataTotaleMs = endTime - giroState.giroStartTime;
    const totalSeconds = Math.floor(durataTotaleMs / 1000);
    const durataTotaleFormattata = formatTime(totalSeconds);

    const endDate = new Date(endTime);
    const oraFineFormattata = `${endDate.toLocaleDateString()} ${endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;


    // Prepare and send WhatsApp summary message
    const waMessage = `RIEPILOGO GIRO CONSEGNE\n\nFattorino: ${giroState.giroFattorino}\nData e Ora Partenza: ${giroState.giroOraPartenza}\nData e Ora Fine: ${oraFineFormattata}\nDurata Totale: ${durataTotaleFormattata}\n\nClienti serviti:\n${giroState.giroClienti.map(c => `- ${c}`).join('\n')}`;
    const encodedMessage = encodeURIComponent(waMessage);
    const waLink = `https://wa.me/393939393799?text=${encodedMessage}`;

    window.open(waLink, '_blank');

    // Save to History (Optional V1)
    const giroSummary: GiroSummary = {
      id: Date.now(),
      date: new Date().toLocaleDateString(),
      fattorino: giroState.giroFattorino,
      duration: durataTotaleFormattata,
      numClients: giroState.giroClienti.length,
      clients: giroState.giroClienti, // Store client names for potential future use
      startTime: giroState.giroOraPartenza,
      endTime: oraFineFormattata,
    };
    setHistory(prevHistory => [giroSummary, ...prevHistory].slice(0, 5)); // Keep last 5

    // Reset Giro State
    setGiroState({
      giroAttivo: false,
      giroStartTime: null,
      giroOraPartenza: null,
      giroFattorino: null,
      giroClienti: [],
    });
    setElapsedTime(0); // Reset timer display

    // Reset Client Input Section
    setClients([{ id: Date.now().toString(), name: "" }]);

    showSuccess("Giro concluso con successo!");
  };

  const handleClearHistory = () => {
    if (confirm("Sei sicuro di voler cancellare tutta la cronologia dei giri?")) {
      setHistory([]);
      showSuccess("Cronologia cancellata.");
    }
  };

  // Handler to toggle history item expansion
  const handleToggleHistoryItem = (id: number) => {
    setExpandedHistoryItem(expandedHistoryItem === id ? null : id);
  };


  return (
    <div className="min-h-screen bg-[#2D2D2D] text-white p-4 flex flex-col items-center">
      {/* Header */}
      <header className="w-full text-center mb-8">
        {/* Add Logo here if available */}
        <h1 className="text-2xl font-bold text-white">A.R. AUTO - Delivery Manager</h1>
        <p className="text-sm text-gray-400">Prodotto da Federico Battistella</p>
      </header>

      <div className="w-full max-w-md space-y-6">

        {/* Sezione Impostazione Fattorino */}
        <Card className="bg-[#4A4A4A] border-none text-white rounded-lg">
          <CardHeader>
            <CardTitle className="flex items-center text-white">
              <User className="mr-2" size={20} /> Fattorino
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Input
                type="text"
                placeholder="Inserisci il tuo nome"
                value={fattorinoName}
                onChange={(e) => setFattorinoName(e.target.value)}
                disabled={!isEditingFattorino}
                className="flex-grow bg-[#3D3D3D] border border-gray-600 text-white placeholder-gray-400 rounded-md"
              />
              {isEditingFattorino ? (
                <Button onClick={handleSaveFattorino} className="bg-[#28a745] hover:bg-[#218838] text-white rounded-md">
                  Salva Nome
                </Button>
              ) : (
                <Button onClick={handleEditFattorino} className="bg-[#555555] hover:bg-[#6c757d] text-white rounded-md">
                  Modifica
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Sezione Inserimento Clienti (Visible only if giro is NOT active) */}
        {!giroState.giroAttivo && (
          <Card className="bg-[#4A4A4A] border-none text-white rounded-lg">
            <CardHeader>
              <CardTitle className="flex items-center text-white">
                <Users className="mr-2" size={20} /> Clienti del Giro
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {clients.map((client, index) => (
                <div key={client.id} className="flex items-center space-x-2">
                  <Label className="text-white">Cliente {index + 1}:</Label>
                  <Input
                    type="text"
                    placeholder={`Nome Cliente ${index + 1}`}
                    value={client.name}
                    onChange={(e) => handleClientNameChange(client.id, e.target.value)}
                    className="flex-grow bg-[#3D3D3D] border border-gray-600 text-white placeholder-gray-400 rounded-md"
                  />
                  {clients.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveClient(client.id)}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <Trash2 size={18} />
                    </Button>
                  )}
                </div>
              ))}
              <div className="flex space-x-2 mt-4">
                <Button onClick={handleAddClient} className="flex-grow bg-[#555555] hover:bg-[#6c757d] text-white rounded-md">
                  + Aggiungi Cliente
                </Button>
                {clients.length > 1 && (
                   <Button onClick={handleResetClients} className="bg-gray-600 hover:bg-gray-700 text-white rounded-md">
                     Reset Lista
                   </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pulsante Azione Principale */}
        <Button
          onClick={giroState.giroAttivo ? handleEndGiro : handleStartGiro}
          className={`w-full text-white text-lg py-6 rounded-lg ${giroState.giroAttivo ? 'bg-[#dc3545] hover:bg-[#c82333]' : 'bg-[#28a745] hover:bg-[#218838]'}`}
        >
          {giroState.giroAttivo ? (
            <StopCircle className="mr-2" size={24} />
          ) : (
            <Play className="mr-2" size={24} />
          )}
          {giroState.giroAttivo ? "Giro Concluso" : "Inizia Giro"}
        </Button>

        {/* Sezione Giro Consegne Attivo (Visible only if giro IS active) */}
        {giroState.giroAttivo && (
          <Card className="bg-[#4A4A4A] border-none text-white rounded-lg">
            <CardHeader>
              <CardTitle className="flex items-center text-white">
                Giro Attivo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-center text-xl font-mono mb-4">
                 Tempo Trascorso: <span className="font-bold">{formatTime(elapsedTime)}</span>
              </div>
              <p><strong>Fattorino:</strong> {giroState.giroFattorino}</p>
              <p><strong>Ora Partenza:</strong> {giroState.giroOraPartenza}</p>
              <div>
                <p className="font-semibold mb-1">Clienti da servire:</p>
                <ul className="list-disc list-inside max-h-40 overflow-y-auto pr-2">
                  {giroState.giroClienti.map((client, index) => (
                    <li key={index} className="text-gray-300">{client}</li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Sezione Cronologia Semplice (Optional V1) */}
        {history.length > 0 && !giroState.giroAttivo && (
           <Card className="bg-[#4A4A4A] border-none text-white rounded-lg">
             <CardHeader>
               <CardTitle className="flex items-center text-white">
                 <History className="mr-2" size={20} /> Ultimi Giri
               </CardTitle>
             </CardHeader>
             <CardContent className="space-y-3">
               <ul className="space-y-2 max-h-40 overflow-y-auto pr-2">
                 {history.map((giro) => (
                   <li key={giro.id} className="border-b border-gray-600 pb-2 last:border-b-0 cursor-pointer" onClick={() => handleToggleHistoryItem(giro.id)}>
                     <div className="flex justify-between items-center">
                       <div>
                         <p className="text-sm text-gray-300">{giro.date}</p>
                         <p><strong>Fattorino:</strong> {giro.fattorino}</p>
                         <p><strong>Durata:</strong> {giro.duration}</p>
                         <p><strong>Clienti:</strong> {giro.numClients}</p> {/* This is now part of the clickable area */}
                       </div>
                       {expandedHistoryItem === giro.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                     </div>
                     {expandedHistoryItem === giro.id && (
                       <div className="mt-2 pl-4">
                         <p className="font-semibold mb-1 text-gray-300">Nomi Clienti:</p>
                         <ul className="list-disc list-inside text-gray-400">
                           {giro.clients.map((client, index) => (
                             <li key={index}>{client}</li>
                           ))}
                         </ul>
                       </div>
                     )}
                   </li>
                 ))}
               </ul>
               <Button onClick={handleClearHistory} className="w-full bg-gray-600 hover:bg-gray-700 text-white rounded-md mt-4">
                 <Trash2 className="mr-2" size={18} /> Cancella Cronologia
               </Button>
             </CardContent>
           </Card>
        )}


      </div>
       {/* Toaster components are already in App.tsx */}
    </div>
  );
};

export default DeliveryManager;