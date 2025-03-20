"use client";

import { useEffect, useRef, useCallback } from "react";
import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
    ArrowUpIcon,
    ChevronDown,
    BrainCircuit,
    Image,
    Code,
    MessageSquare,
    Zap,
    Stars,
    Loader2,
    Sparkles,
    Bot,
    LightbulbIcon,
    BrainCog,
    Settings,
    X,
    Save,
    Trash2,
} from "lucide-react";
import { 
    GoogleGenerativeAI,
    HarmCategory,
    HarmBlockThreshold 
} from "@google/generative-ai";

// API anahtarlarını env'den alıyoruz
const GOOGLE_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_AI_API_KEY || "AIzaSyADriSfO9rwfVsadffsdFe0DHCp0aK_Hk0idMj5asdfsaYo";
const DEEPSEEK_API_KEY = process.env.NEXT_PUBLIC_DEEPSEEK_API_KEY || "sk-afd45e3754asdfdsa8a455d805sdfa4b37acasdf7e2e96";

// Gemini API için istemci oluşturuyoruz
const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);

// Varsayılan sistem promptu
const DEFAULT_SYSTEM_PROMPT = `Siz yordamchi AI assistentisiz. Savollarga qisqa, aniq va to'g'ri javoblar berishga harakat qiling. Agar savolning javobini bilmasangiz, bilmasligingizni ayting va taxmin qilmang. Foydalanuvchining ona tili o'zbek tili; shuning uchun o'zbek tilida javob bering.`;

// Model mappings - burada modellerin API isimleri ile UI isimleri eşleştiriliyor
const MODEL_MAPPINGS: Record<string, string> = {
    "gemini-2.0-flash": "gemini-2.0-flash-001",
    "gemini-2.0-flash-lite": "gemini-2.0-flash-lite-001",
    "gemini-2.0-pro-exp-02-05": "gemini-2.0-pro-exp-02-05",
    "gemma-3-27b-it": "gemma-3-27b-it",
    "deepseek-v3": "deepseek-chat", // DeepSeek modelini ekledik
};

// Model tipi ve model seçenekleri için interface ve sabitler
interface AIModel {
    id: string;
    name: string;
    icon: React.ReactNode;
    description: string;
}

const AI_MODELS: AIModel[] = [
    // DeepSeek Modeli
    {
        id: "deepseek-v3",
        name: "DeepSeek Chat",
        icon: <BrainCircuit className="w-4 h-4" />, 
        description: "DeepSeek'ning rivojlangan sun'iy intellekt suhbat modeli"
    },
    // Gemini 2.0 Modelleri - En yeni modeller en başta
    {
        id: "gemini-2.0-flash",
        name: "Gemini 2.0 Flash",
        icon: <Sparkles className="w-4 h-4" />,
        description: "Gemini 2.0'ning tez javob beruvchi modeli"
    },
    {
        id: "gemini-2.0-flash-lite",
        name: "Gemini 2.0 Flash Lite",
        icon: <Zap className="w-4 h-4" />,
        description: "Yengil va tezkor 2.0 Flash versiyasi"
    },
    {
        id: "gemini-2.0-pro-exp-02-05",
        name: "Gemini 2.0 Pro Exp",
        icon: <BrainCog className="w-4 h-4" />,
        description: "Rivojlangan tajribaviy 2.0 Pro modeli (02-05)"
    },
    
    // Gemma Modeli
    {
        id: "gemma-3-27b-it",
        name: "Gemma 3 (27B)",
        icon: <Bot className="w-4 h-4" />,
        description: "27 milliard parametrli ochiq manbali LLM"
    },
];

// Mesaj tipi için interface
interface Message {
    id: string;
    role: "user" | "model";
    content: string;
}

interface UseAutoResizeTextareaProps {
    minHeight: number;
    maxHeight?: number;
}

function useAutoResizeTextarea({
    minHeight,
    maxHeight,
}: UseAutoResizeTextareaProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const adjustHeight = useCallback(
        (reset?: boolean) => {
            const textarea = textareaRef.current;
            if (!textarea) return;

            if (reset) {
                textarea.style.height = `${minHeight}px`;
                return;
            }

            // Temporarily shrink to get the right scrollHeight
            textarea.style.height = `${minHeight}px`;

            // Calculate new height
            const newHeight = Math.max(
                minHeight,
                Math.min(
                    textarea.scrollHeight,
                    maxHeight ?? Number.POSITIVE_INFINITY
                )
            );

            textarea.style.height = `${newHeight}px`;
        },
        [minHeight, maxHeight]
    );

    useEffect(() => {
        // Set initial height
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = `${minHeight}px`;
        }
    }, [minHeight]);

    // Adjust height on window resize
    useEffect(() => {
        const handleResize = () => adjustHeight();
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, [adjustHeight]);

    return { textareaRef, adjustHeight };
}

// Unique ID oluşturmak için yardımcı fonksiyon
function generateId(): string {
    return Math.random().toString(36).substring(2, 15);
}

// chatOptions: any o'rniga
interface ChatOptions {
    generationConfig: {
        temperature: number;
        topK: number;
        topP: number;
        maxOutputTokens: number;
    };
    safetySettings: Array<{
        category: string;
        threshold: string;
    }>;
    history?: Array<{
        role: string;
        parts: Array<{ text: string }>;
    }>;
    systemInstruction?: string;
}

export function VercelV0Chat() {
    const [value, setValue] = useState("");
    const [selectedModel, setSelectedModel] = useState<AIModel>(AI_MODELS[3]);
    const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
    const [isPromptPanelOpen, setIsPromptPanelOpen] = useState(false);
    const [tempSystemPrompt, setTempSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
    const [dropdownDirection, setDropdownDirection] = useState<'down' | 'up'>('down');
    const dropdownButtonRef = useRef<HTMLButtonElement>(null);
    
    const { textareaRef, adjustHeight } = useAutoResizeTextarea({
        minHeight: 60,
        maxHeight: 200,
    });

    // Dropdown açılma yönünü belirler
    useEffect(() => {
        const checkDropdownDirection = () => {
            if (dropdownButtonRef.current) {
                const buttonRect = dropdownButtonRef.current.getBoundingClientRect();
                const windowHeight = window.innerHeight;
                const spaceBelow = windowHeight - buttonRect.bottom;
                
                // Eğer aşağıda 300px'den az alan varsa dropdown'u yukarı açalım
                if (spaceBelow < 300 && buttonRect.top > 300) {
                    setDropdownDirection('up');
                } else {
                    setDropdownDirection('down');
                }
            }
        };
        
        // İlk render'da ve pencere yeniden boyutlandırıldığında kontrol et
        checkDropdownDirection();
        window.addEventListener('resize', checkDropdownDirection);
        
        return () => {
            window.removeEventListener('resize', checkDropdownDirection);
        };
    }, []);
    
    // Dropdown açıldığında yönünü tekrar kontrol et
    useEffect(() => {
        if (isModelDropdownOpen && dropdownButtonRef.current) {
            const buttonRect = dropdownButtonRef.current.getBoundingClientRect();
            const windowHeight = window.innerHeight;
            const spaceBelow = windowHeight - buttonRect.bottom;
            
            if (spaceBelow < 300 && buttonRect.top > 300) {
                setDropdownDirection('up');
            } else {
                setDropdownDirection('down');
            }
        }
    }, [isModelDropdownOpen]);

    // Sistem promptunu sıfırlama fonksiyonu
    const resetSystemPrompt = () => {
        setTempSystemPrompt(DEFAULT_SYSTEM_PROMPT);
    };

    // Sistem promptunu kaydetme fonksiyonu
    const saveSystemPrompt = () => {
        setSystemPrompt(tempSystemPrompt);
        setIsPromptPanelOpen(false);
        
        // Prompt kaydedildikten sonra imleç input alanına odaklansın
        setTimeout(() => {
            if (textareaRef.current) {
                textareaRef.current.focus();
            }
        }, 0);
    };

    // Prompt paneli açıldığında geçici prompt'u güncelleriz
    useEffect(() => {
        if (isPromptPanelOpen) {
            setTempSystemPrompt(systemPrompt);
        }
    }, [isPromptPanelOpen, systemPrompt]);

    // Mesaj gönderme fonksiyonu
    const sendMessage = async () => {
        if (!value.trim() || isLoading) return;
        
        const userMessage: Message = {
            id: generateId(),
            role: "user",
            content: value.trim(),
        };
        
        // Mesajı ekleyelim ve inputu temizleyelim
        setMessages((prev) => [...prev, userMessage]);
        setValue("");
        
        // Referansı saklayalım
        const textareaElement = textareaRef.current;
        
        // Yüksekliği resetleyelim
        adjustHeight(true);
        setIsLoading(true);
        
        try {
            // Textarea elementine odaklanalım (ref sakladığımız için ulaşabiliriz)
            if (textareaElement) {
                textareaElement.focus();
            }
            
            if (selectedModel.id === "deepseek-v3") {
                // DeepSeek API kullanıyoruz
                const response = await fetchDeepSeekResponse(userMessage.content, messages, systemPrompt);
                
                // Yanıtı mesajlara ekliyoruz
                const assistantMessage: Message = {
                    id: generateId(),
                    role: "model",
                    content: response,
                };
                
                setMessages((prev) => [...prev, assistantMessage]);
            } else {
                // Gemini API'yi kullanarak yanıt alıyoruz
                const modelName = MODEL_MAPPINGS[selectedModel.id] || "gemini-1.5-pro";
                const model = genAI.getGenerativeModel({ model: modelName });
                
                // Güvenlik ayarları
                const generationConfig = {
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 2048,
                };
                
                const safetySettings = [
                    {
                        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                    },
                    {
                        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                    },
                    {
                        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                    },
                    {
                        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
                        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                    },
                ];
                
                // Mesaj geçmişini hazırlıyoruz
                const history = messages.map(msg => ({
                    role: msg.role === "user" ? "user" : "model",
                    parts: [{ text: msg.content }]
                }));
                
                // Chat ayarları - model türüne göre sistem talimatlarını ayarlayalım
                const chatOptions: ChatOptions = {
                    generationConfig,
                    safetySettings,
                    history: history.length > 0 ? history.slice(0, -1) : undefined,
                };
                
                // Gemini 2.0 ve Gemma modelleri için farklı sistem prompt yapısı kullanmalıyız
                if (selectedModel.id.startsWith("gemini-2.0") || selectedModel.id.startsWith("gemma")) {
                    // Gemini 2.0 ve Gemma modelleri için uygun format
                    if (systemPrompt) {
                        try {
                            // Ilk olarak sistem rolünü oluşturalım
                            const systemMessage = {
                                role: "user",
                                parts: [{ text: systemPrompt }]
                            };
                            
                            // Boş model yanıtı ekleyelim (bunu API bekliyor)
                            const modelResponse = {
                                role: "model",
                                parts: [{ text: "I'll help you with that." }]
                            };
                            
                            // Sistem mesajını history'nin başına ekleyelim
                            const historyWithSystem = [systemMessage, modelResponse];
                            
                            // Eğer history varsa, ona ekleyelim
                            if (history.length > 0) {
                                chatOptions.history = [...historyWithSystem, ...history.slice(0, -1)];
                            } else {
                                chatOptions.history = historyWithSystem;
                            }
                        } catch (error) {
                            console.error("Sistem prompt formatlama hatası:", error);
                        }
                    }
                } else {
                    // Gemini 1.x modelleri için doğrudan system instruction kullanabiliriz
                    if (systemPrompt) {
                        chatOptions.systemInstruction = systemPrompt;
                    }
                }
                
                // Chat başlatıyoruz
                const chat = model.startChat(chatOptions);
                
                // Yanıt istiyoruz
                const result = await chat.sendMessage(userMessage.content);
                const response = result.response.text();
                
                // Yanıtı mesajlara ekliyoruz
                const assistantMessage: Message = {
                    id: generateId(),
                    role: "model",
                    content: response,
                };
                
                setMessages((prev) => [...prev, assistantMessage]);
            }
        } catch (error) {
            console.error("API hatası:", error);
            
            // Hata mesajı
            const errorMessage: Message = {
                id: generateId(),
                role: "model",
                content: "Üzgünüm, bir hata oluştu. Lütfen tekrar deneyin. Hata detayı: " + String(error),
            };
            
            setMessages((prev) => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    // DeepSeek API'sini kullanarak yanıt alma fonksiyonu
    const fetchDeepSeekResponse = async (
        userMessage: string, 
        messageHistory: Message[], 
        systemInstructions: string
    ): Promise<string> => {
        // DeepSeek API endpointi
        const endpoint = "https://api.deepseek.com/v1/chat/completions";
        
        // Mesaj geçmişini hazırlıyoruz
        const messages = [];
        
        // Sistem talimatı ekle
        if (systemInstructions) {
            messages.push({
                role: "system",
                content: systemInstructions
            });
        }
        
        // Mesaj geçmişini ekle
        messageHistory.forEach(msg => {
            messages.push({
                role: msg.role === "user" ? "user" : "assistant", 
                content: msg.content
            });
        });
        
        // Kullanıcının mesajını ekle
        messages.push({
            role: "user",
            content: userMessage
        });
        
        // API isteği için konfigürasyon
        const requestOptions = {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${DEEPSEEK_API_KEY}`
            },
            body: JSON.stringify({
                model: "deepseek-chat",
                messages: messages,
                temperature: 0.7,
                max_tokens: 2048,
            })
        };
        
        try {
            // API isteği gönder
            const response = await fetch(endpoint, requestOptions);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(`DeepSeek API hatası: ${data.error?.message || JSON.stringify(data)}`);
            }
            
            // Yanıtı döndür
            return data.choices[0].message.content;
        } catch (error) {
            console.error("DeepSeek API hatası:", error);
            throw error;
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };
    
    // Mesajların en altına otomatik kaydırma ve input odaklama
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        if (!isLoading && textareaRef.current) {
            textareaRef.current.focus();
        }
    }, [messages, isLoading, textareaRef]);

    // Mesaj geçmişini temizleme fonksiyonu
    const clearMessages = () => {
        setMessages([]);
    };

    return (
        <div className="flex flex-col items-center w-full max-w-4xl mx-auto p-4 space-y-8 relative h-[calc(100vh-8rem)]">
            <div className="flex items-center justify-between w-full">
                {messages.length > 0 && (
                    <button
                        aria-label="Mesaj Geçmişini Temizle"
                        className="text-zinc-400 hover:text-zinc-200 transition-colors p-2 ml-auto"
                        onClick={clearMessages}
                    >
                        <Trash2 className="w-5 h-5" />
                    </button>
                )}
            </div>

            <div className="w-full flex flex-col h-full relative">
                {/* Mesaj geçmişi - Artık her zaman görünür */}
                <div className="bg-neutral-900 rounded-xl border border-neutral-800 mb-4 p-4 overflow-y-auto flex-grow max-h-[calc(100vh-16rem)]">
                    <div className="flex flex-col space-y-4">
                        {messages.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-32 text-center">
                                <div className="mb-2 text-white text-opacity-80">
                                    <BrainCircuit className="w-8 h-8 mx-auto mb-2" />
                                    <p className="text-sm font-medium">Sun'iy intellekt yordamchingiz tayyor</p>
                                </div>
                                <p className="text-xs text-zinc-500 max-w-md">
                                    Tanlangan model: <span className="text-zinc-400">{selectedModel.name}</span>. 
                                    Istalgan savolingizni berishingiz mumkin.
                                </p>
                            </div>
                        ) : (
                            <>
                                {messages.map((message) => (
                                    <div 
                                        key={message.id}
                                        className={cn(
                                            "p-3 rounded-lg max-w-[80%]",
                                            message.role === "user" 
                                                ? "bg-neutral-800 ml-auto" 
                                                : "bg-neutral-700 mr-auto"
                                        )}
                                    >
                                        <p className="text-sm text-white whitespace-pre-wrap">
                                            {message.content}
                                        </p>
                                    </div>
                                ))}
                            </>
                        )}
                        {isLoading && (
                            <div className="bg-neutral-700 p-3 rounded-lg max-w-[80%] mr-auto flex items-center space-x-2">
                                <Loader2 className="w-4 h-4 animate-spin text-white" />
                                <p className="text-sm text-white">
                                    Javob yozilmoqda...
                                </p>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                </div>
                
                {/* Input alanı - Alt kısma sabitlendi */}
                <div className="relative bg-neutral-900 rounded-xl border border-neutral-800 mt-auto sticky bottom-0">
                    <div className="overflow-y-auto">
                        <Textarea
                            ref={textareaRef}
                            value={value}
                            onChange={(e) => {
                                setValue(e.target.value);
                                adjustHeight();
                            }}
                            onKeyDown={handleKeyDown}
                            placeholder={`${selectedModel.name} bilan savol bering...`}
                            className={cn(
                                "w-full px-4 py-3",
                                "resize-none",
                                "bg-transparent",
                                "border-none",
                                "text-white text-sm",
                                "focus:outline-none",
                                "focus-visible:ring-0 focus-visible:ring-offset-0",
                                "placeholder:text-neutral-500 placeholder:text-sm",
                                "min-h-[60px]"
                            )}
                            style={{
                                overflow: "hidden",
                            }}
                            disabled={isLoading}
                        />
                    </div>

                    <div className="flex items-center justify-between p-3">
                        <div className="flex items-center gap-2">
                            {/* Model seçim dropdown */}
                            <div className="relative">
                                <button
                                    ref={dropdownButtonRef}
                                    type="button"
                                    className="group p-2 hover:bg-neutral-800 rounded-lg transition-colors flex items-center gap-1"
                                    onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                                >
                                    <div className="flex items-center gap-1">
                                        {selectedModel.icon}
                                        <span className="text-xs text-zinc-400">
                                            {selectedModel.name}
                                        </span>
                                        <ChevronDown className="w-3 h-3 text-zinc-400" />
                                    </div>
                                </button>
                                
                                {isModelDropdownOpen && (
                                    <div 
                                        className={cn(
                                            "absolute left-0 mt-1 w-72 bg-neutral-800 border border-neutral-700 rounded-lg shadow-lg z-10 max-h-80 overflow-y-auto",
                                            dropdownDirection === 'up' ? "bottom-full mb-1" : "top-full mt-1"
                                        )}
                                    >
                                        <div className="py-1">
                                            {/* DeepSeek Modeli Başlık */}
                                            <div className="px-4 py-1 text-xs text-zinc-500 border-b border-zinc-700">
                                                DeepSeek Modellari
                                            </div>
                                            {AI_MODELS.slice(0, 1).map((model) => (
                                                <button
                                                    key={model.id}
                                                    className={cn(
                                                        "flex items-center gap-2 w-full px-4 py-2 text-left text-sm",
                                                        "hover:bg-neutral-700 transition-colors",
                                                        model.id === selectedModel.id ? "text-white bg-neutral-700" : "text-zinc-400"
                                                    )}
                                                    onClick={() => {
                                                        setSelectedModel(model);
                                                        setIsModelDropdownOpen(false);
                                                    }}
                                                >
                                                    {model.icon}
                                                    <div className="flex flex-col">
                                                        <span>{model.name}</span>
                                                        <span className="text-xs text-zinc-500">{model.description}</span>
                                                    </div>
                                                </button>
                                            ))}

                                            {/* Gemini 2.0 Modelleri Başlık */}
                                            <div className="px-4 py-1 text-xs text-zinc-500 border-b border-zinc-700 border-t border-zinc-700 mt-1">
                                                Gemini 2.0 Modellari
                                            </div>
                                            {AI_MODELS.slice(1, 4).map((model) => (
                                                <button
                                                    key={model.id}
                                                    className={cn(
                                                        "flex items-center gap-2 w-full px-4 py-2 text-left text-sm",
                                                        "hover:bg-neutral-700 transition-colors",
                                                        model.id === selectedModel.id ? "text-white bg-neutral-700" : "text-zinc-400"
                                                    )}
                                                    onClick={() => {
                                                        setSelectedModel(model);
                                                        setIsModelDropdownOpen(false);
                                                    }}
                                                >
                                                    {model.icon}
                                                    <div className="flex flex-col">
                                                        <span>{model.name}</span>
                                                        <span className="text-xs text-zinc-500">{model.description}</span>
                                                    </div>
                                                </button>
                                            ))}

                                            {/* Gemma Modelleri Başlık */}
                                            <div className="px-4 py-1 text-xs text-zinc-500 border-t border-zinc-700 mt-1">
                                                Gemma Modellari
                                            </div>
                                            {AI_MODELS.slice(4).map((model) => (
                                                <button
                                                    key={model.id}
                                                    className={cn(
                                                        "flex items-center gap-2 w-full px-4 py-2 text-left text-sm",
                                                        "hover:bg-neutral-700 transition-colors",
                                                        model.id === selectedModel.id ? "text-white bg-neutral-700" : "text-zinc-400"
                                                    )}
                                                    onClick={() => {
                                                        setSelectedModel(model);
                                                        setIsModelDropdownOpen(false);
                                                    }}
                                                >
                                                    {model.icon}
                                                    <div className="flex flex-col">
                                                        <span>{model.name}</span>
                                                        <span className="text-xs text-zinc-500">{model.description}</span>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                className={cn(
                                    "px-1.5 py-1.5 rounded-lg text-sm transition-colors border border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800 flex items-center justify-between gap-1",
                                    value.trim() && !isLoading
                                        ? "bg-white text-black"
                                        : "text-zinc-400",
                                    isLoading && "opacity-50 cursor-not-allowed"
                                )}
                                onClick={sendMessage}
                                disabled={isLoading || !value.trim()}
                            >
                                {isLoading ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <ArrowUpIcon
                                        className={cn(
                                            "w-4 h-4",
                                            value.trim()
                                                ? "text-black"
                                                : "text-zinc-400"
                                        )}
                                    />
                                )}
                                <span className="sr-only">Send</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Sistem Prompt Ayarları Butonu */}
            <button
                aria-label="Sistem Prompt Ayarları"
                className="fixed bottom-4 right-4 w-12 h-12 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center hover:bg-neutral-700 transition-colors shadow-lg z-50"
                onClick={() => setIsPromptPanelOpen(!isPromptPanelOpen)}
            >
                <Settings className="w-5 h-5 text-white" />
            </button>

            {/* Sistem Prompt Paneli - Responsive hale getirildi */}
            {isPromptPanelOpen && (
                <div className="fixed bottom-20 sm:right-4 rounded-lg shadow-xl z-50 p-4 flex flex-col gap-3 
                    bg-neutral-800 border border-neutral-700
                    w-[90vw] sm:w-96 max-w-full mx-auto left-0 right-0 sm:left-auto sm:mx-0">
                    <div className="flex items-center justify-between border-b border-neutral-700 pb-2">
                        <h3 className="text-white font-medium">Tizim Promptini Tahrirlash</h3>
                        <button 
                            className="text-zinc-400 hover:text-white"
                            onClick={() => setIsPromptPanelOpen(false)}
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    
                    <p className="text-xs text-zinc-400">
                        Sun'iy intellekt modeliga yuboriladigan tizim ko'rsatmalarini tahrirlang. Bu modelning shaxsiyati va javob berish uslubini o'zgartiradi.
                    </p>
                    
                    <div className="relative flex-grow overflow-auto min-h-[150px] max-h-[300px]">
                        <Textarea
                            value={tempSystemPrompt}
                            onChange={(e) => setTempSystemPrompt(e.target.value)}
                            placeholder="Tizim promptini kiriting..."
                            className="min-h-[150px] h-full w-full resize-none text-sm bg-neutral-900 border-neutral-700 text-white overflow-y-auto"
                        />
                    </div>
                    
                    <div className="flex justify-between">
                        <button
                            className="px-3 py-1.5 text-xs text-zinc-300 hover:text-white"
                            onClick={resetSystemPrompt}
                        >
                            Standart holatga qaytarish
                        </button>
                        
                        <button
                            className="px-3 py-1.5 bg-neutral-700 hover:bg-neutral-600 text-white rounded flex items-center gap-1.5 text-xs"
                            onClick={saveSystemPrompt}
                        >
                            <Save className="w-3.5 h-3.5" />
                            Saqlash
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
} 