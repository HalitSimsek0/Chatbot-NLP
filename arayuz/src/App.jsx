import { useState, useRef, useEffect, useMemo, memo, useCallback } from "react";
import chatService from "./services/chatService";

// Link parse fonksiyonu
function parseMessage(text) {
  const urlRegex = /https?:\/\/[^\s)]+/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = urlRegex.exec(text)) !== null) {
    // Match'den önceki kısmı ekle
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    
    // Link'i ekle
    parts.push(
      <a
        key={match.index}
        href={match[0]}
        target="_blank"
        rel="noopener noreferrer"
        className="underline hover:text-blue-700 transition-colors text-blue-600"
      >
        {match[0]}
      </a>
    );
    
    lastIndex = match.index + match[0].length;
  }
  
  // Son kısmı ekle
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }
  
  return parts.length > 0 ? parts : text;
}

export default function App() {
  const [messages, setMessages] = useState([
    {
      id: 1,
      from: "bot",
      text: "Merhaba! 👋 Ben İSTE ChatBot'u. Size nasıl yardımcı olabilirim?",
      timestamp: new Date(),
    },
  ]);

  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [typingText, setTypingText] = useState("");
  const [typingMessageId, setTypingMessageId] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [apiStatus, setApiStatus] = useState("checking");
  const [chatHistory, setChatHistory] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [showMenuId, setShowMenuId] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [colorCategory, setColorCategory] = useState('background'); // 'background', 'bot', 'user'

  const fetchSessions = useCallback(async () => {
    try {
      const sessions = await chatService.listSessions();
      setChatHistory(sessions);
    } catch (error) {
      console.error('Sohbet listesi alınamadı:', error);
    }
  }, []);
  
  // localStorage'dan ayarları yükle (initial state)
  const getInitialSettings = () => {
    try {
      const savedSettings = localStorage.getItem('chatbotSettings');
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        return {
          backgroundColor: parsed.backgroundColor || '#f9edfa',
          botMessageColor: parsed.botMessageColor || '#A5C9CA',
          userMessageColor: parsed.userMessageColor || '#E7AB9A',
          fontFamily: parsed.fontFamily || 'Inter'
        };
      }
    } catch (error) {
      console.error('Ayarlar yüklenirken hata:', error);
    }
    return {
      backgroundColor: '#f9edfa',
      botMessageColor: '#A5C9CA',
      userMessageColor: '#E7AB9A',
      fontFamily: 'Inter'
    };
  };
  
  const [settings, setSettings] = useState(getInitialSettings);

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const recognitionRef = useRef(null);

  // Speech Recognition setup
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'tr-TR'; // Türkçe dil desteği
      
      recognition.onstart = () => {
        setIsListening(true);
      };
      
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInput(prev => prev + (prev ? ' ' : '') + transcript);
        setIsListening(false);
      };
      
      recognition.onerror = (event) => {
        console.error('Ses tanıma hatası:', event.error);
        setIsListening(false);
        if (event.error === 'no-speech') {
          alert('Konuşma algılanamadı. Lütfen tekrar deneyin.');
        } else if (event.error === 'not-allowed') {
          alert('Mikrofon izni verilmedi. Lütfen tarayıcı ayarlarından izin verin.');
        }
      };
      
      recognition.onend = () => {
        setIsListening(false);
      };
      
      recognitionRef.current = recognition;
    } else {
      console.warn('Ses tanıma bu tarayıcıda desteklenmiyor.');
    }
    
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  // Mikrofon butonuna tıklama
  const handleMicrophoneClick = () => {
    if (!recognitionRef.current) {
      alert('Ses tanıma özelliği bu tarayıcıda desteklenmiyor. Lütfen Chrome veya Edge kullanın.');
      return;
    }
    
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
      } catch (error) {
        console.error('Ses tanıma başlatılamadı:', error);
        setIsListening(false);
      }
    }
  };

  // Ayarları localStorage'a kaydet (her değişiklikte)
  useEffect(() => {
    try {
      localStorage.setItem('chatbotSettings', JSON.stringify(settings));
    } catch (error) {
      console.error('Ayarlar kaydedilirken hata:', error);
    }
  }, [settings]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);


  // API durumu
  useEffect(() => {
    const checkApi = async () => {
      try {
        const isOnline = await chatService.checkApiStatus();
        setApiStatus(isOnline ? "online" : "offline");
      } catch {
        setApiStatus("offline");
      }
    };
    checkApi();
    const interval = setInterval(checkApi, 30000);
    return () => clearInterval(interval);
  }, []);

  // Sohbeti geçmişe kaydet (manuel kaydetme için)
  // Sohbeti yükle
  const loadChat = async (chatId) => {
    try {
      const history = await chatService.getChatHistory(chatId);
      if (history?.messages) {
        const hydratedMessages = history.messages.length > 0
          ? history.messages.map((msg, index) => ({
              id: msg.id ?? index + 1,
              from: msg.sender || msg.from,
              text: msg.text,
              timestamp: msg.createdAt ? new Date(msg.createdAt) : new Date(),
            }))
          : [{
              id: Date.now(),
              from: "bot",
              text: "Merhaba! 👋 Ben İSTE ChatBot'u. Size nasıl yardımcı olabilirim?",
              timestamp: new Date(),
            }];
        setMessages(hydratedMessages);
        setSessionId(history.session?.id || chatId);
        setCurrentChatId(history.session?.id || chatId);
        setIsTyping(false);
        setTypingMessageId(null);
        setTypingText("");
      }
    } catch (error) {
      console.error('Sohbet yüklenemedi:', error);
    }
  };

  // Sohbeti sil
  const deleteChat = async (chatId, e) => {
    e.stopPropagation();
    try {
      await chatService.deleteSession(chatId);
      setChatHistory(prev => prev.filter(c => c.id !== chatId));
      fetchSessions();
    if (currentChatId === chatId) {
      startNewChat();
    }
    setShowMenuId(null);
    } catch (error) {
      console.error('Sohbet silinemedi:', error);
      alert('Sohbet silinirken bir hata oluştu.');
    }
  };

  // Typing effect - Bot mesajını karakter karakter göster
  useEffect(() => {
    if (!typingMessageId) return;
    
    const message = messages.find(m => m.id === typingMessageId);
    if (!message || !message.fullText) return;
    
    const fullText = message.fullText;
    let currentIndex = 0;
    
    const typingInterval = setInterval(() => {
      if (currentIndex < fullText.length) {
        setTypingText(fullText.substring(0, currentIndex + 1));
        currentIndex++;
      } else {
        clearInterval(typingInterval);
        // Typing tamamlandığında mesajın text'ini güncelle
        setMessages(prev => prev.map(msg => 
          msg.id === typingMessageId 
            ? { ...msg, text: fullText }
            : msg
        ));
        setTypingMessageId(null);
        setTypingText("");
      }
    }, 30); // Her 30ms'de bir karakter (hızlı yazma)
    
    return () => clearInterval(typingInterval);
  }, [typingMessageId, messages]);

  // Otomatik kaydır
  const scrollToBottom = () =>
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  useEffect(scrollToBottom, [messages, typingText]);

  // textarea auto resize
  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "auto";
    textareaRef.current.style.height =
      Math.min(textareaRef.current.scrollHeight, 120) + "px";
  }, [input]);

  // Sık sorulan soruyu gönder
  const sendQuickQuestion = async (question) => {
    if (isTyping) return;

    const userMessage = {
      id: Date.now(),
      from: "user",
      text: question,
      timestamp: new Date(),
    };

    // Eğer yeni sohbetse ID oluştur
    if (!currentChatId) {
      setCurrentChatId(Date.now().toString());
    }
    
    setMessages((prev) => [...prev, userMessage]);
    setIsTyping(true);

    try {
      const response = await chatService.sendMessage(question, sessionId);
      const fullText = response?.message || "Üzgünüm, bir hata oluştu. Lütfen tekrar deneyin.";
      const responseSessionId = response?.sessionId || sessionId;
      
      const botMessageId = Date.now() + 1;
      const botMessage = {
        id: botMessageId,
        from: "bot",
        text: "",
        fullText: fullText, // Tam metni sakla
        timestamp: new Date(),
      };
      
      // Mesajı hemen ekle (boş text ile)
      setMessages((prev) => [...prev, botMessage]);
      if (responseSessionId) {
        setSessionId(responseSessionId);
        setCurrentChatId(responseSessionId);
      }
      
      // Typing effect başlat
      setTypingMessageId(botMessageId);
      setTypingText("");
      fetchSessions();
      
    } catch {
      const fullText = "WebAPI bağlantısı kurulamadı. Lütfen API'nin çalıştığını kontrol edin.";
      const botMessageId = Date.now() + 1;
      const botMessage = {
        id: botMessageId,
        from: "bot",
        text: "",
        fullText: fullText,
        timestamp: new Date(),
      };
      
      setMessages((prev) => [...prev, botMessage]);
      setTypingMessageId(botMessageId);
      setTypingText("");
    } finally {
      setIsTyping(false);
    }
  };

  const sendMessage = async () => {
    const value = input.trim();
    if (!value || isTyping) return;

    const userMessage = {
      id: Date.now(),
      from: "user",
      text: value,
      timestamp: new Date(),
    };

    // Eğer yeni sohbetse ID oluştur
    if (!currentChatId) {
      setCurrentChatId(Date.now().toString());
    }
    
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);

    try {
      const response = await chatService.sendMessage(value, sessionId);
      const fullText = response?.message || "Üzgünüm, bir hata oluştu. Lütfen tekrar deneyin.";
      const responseSessionId = response?.sessionId || sessionId;
      
      const botMessageId = Date.now() + 1;
      const botMessage = {
        id: botMessageId,
        from: "bot",
        text: "",
        fullText: fullText, // Tam metni sakla
        timestamp: new Date(),
      };
      
      // Mesajı hemen ekle (boş text ile)
      setMessages((prev) => [...prev, botMessage]);
      if (responseSessionId) {
        setSessionId(responseSessionId);
        setCurrentChatId(responseSessionId);
      }
      
      // Typing effect başlat
      setTypingMessageId(botMessageId);
      setTypingText("");
      fetchSessions();
      
    } catch {
      const fullText = "WebAPI bağlantısı kurulamadı. Lütfen API'nin çalıştığını kontrol edin.";
      const botMessageId = Date.now() + 1;
      const botMessage = {
        id: botMessageId,
        from: "bot",
        text: "",
        fullText: fullText,
        timestamp: new Date(),
      };
      
      setMessages((prev) => [...prev, botMessage]);
      setTypingMessageId(botMessageId);
      setTypingText("");
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const startNewChat = () => {
    if (currentChatId && messages.length > 1) {
      fetchSessions();
    }

    setSessionId(null);
    setCurrentChatId(null);
    setMessages([
      {
        id: Date.now(),
        from: "bot",
        text: "Merhaba! 👋 Ben İSTE ChatBot'u. Size nasıl yardımcı olabilirim?",
        timestamp: new Date(),
      },
    ]);
    setShowMenuId(null);
  };

  const timeOf = useMemo(
    () => (date) =>
      new Date(date).toLocaleTimeString("tr-TR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    []
  );

  // Font'u global olarak uygula
  useEffect(() => {
    document.documentElement.style.fontFamily = settings.fontFamily;
    return () => {
      document.documentElement.style.fontFamily = '';
    };
  }, [settings.fontFamily]);

  return (
    <div className="h-screen w-screen overflow-hidden" style={{ width: '100vw', height: '100vh', backgroundColor: settings.backgroundColor, fontFamily: settings.fontFamily }}>
      {/* Modern subtle background effects */}
      <div className="absolute inset-0">
        <div className="absolute top-20 right-20 w-[400px] h-[400px] bg-white/20 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-20 w-[350px] h-[350px] bg-white/15 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 flex h-full" style={{ width: '100%', height: '100%', fontFamily: settings.fontFamily }}>
        {/* Sidebar - Modern clean white style */}
        <div className="w-[280px] bg-white/70 backdrop-blur-xl border-r border-gray-200/50 flex flex-col shadow-lg rounded-r-3xl" style={{ boxShadow: '4px 0 30px rgba(0, 0, 0, 0.06)', fontFamily: settings.fontFamily }}>
          <div className="p-8 border-b border-gray-200/50">
            <button
              onClick={startNewChat}
              className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold py-4 px-6 rounded-2xl transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] text-base"
              style={{ boxShadow: '0 4px 16px rgba(59, 130, 246, 0.3)', fontSize: '16px' }}
            >
              + Yeni Sohbet
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-3" style={{ position: 'relative', overflowY: 'auto', overflowX: 'visible' }}>
            {/* Geçmiş Sohbetler */}
            <div className="mb-4" style={{ position: 'relative' }}>
              <h3 className="text-sm font-semibold text-gray-600 mb-3 px-2">Geçmiş Sohbetler</h3>
              {chatHistory.length === 0 ? (
                <div className="text-xs text-gray-400 text-center py-4">
                  Henüz sohbet geçmişi yok
                </div>
              ) : (
                chatHistory.map((chat) => {
                  const displayTitle = chat.title ? `💬 ${chat.title}` : '💬 Yeni Sohbet';
                  const lastUpdatedLabel = chat.lastUpdated
                    ? new Date(chat.lastUpdated).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                    : '';
                  return (
                  <div
                    key={chat.id}
                    data-chat-id={chat.id}
                    onClick={() => loadChat(chat.id)}
                    className={`relative rounded-2xl mb-3 cursor-pointer transition-all duration-200 border ${
                      currentChatId === chat.id
                        ? "bg-blue-50 border-blue-200 shadow-md"
                        : "border-gray-200/50 hover:border-gray-300 bg-white/50 hover:bg-gray-50"
                    } backdrop-blur-sm text-left hover:shadow-md`}
                    style={{ 
                      padding: '16px',
                      boxShadow: currentChatId === chat.id ? '0 2px 8px rgba(59, 130, 246, 0.15)' : '0 2px 8px rgba(0, 0, 0, 0.04)',
                      position: 'relative',
                      zIndex: showMenuId === chat.id ? 1000 : 'auto'
                    }}
                    onMouseLeave={() => {
                      // Menü açıkken mouse leave olmasını bekle
                      if (showMenuId !== chat.id) {
                        setTimeout(() => setShowMenuId(null), 150);
                      }
                    }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-700 truncate" style={{ fontSize: '15px', lineHeight: '1.4' }}>
                          {displayTitle}
                        </div>
                        {lastUpdatedLabel && (
                        <div className="text-gray-400 mt-1.5" style={{ fontSize: '12px' }}>
                            {lastUpdatedLabel}
                        </div>
                        )}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          setShowMenuId(prev => prev === chat.id ? null : chat.id);
                        }}
                        className="w-7 h-7 rounded-full hover:bg-gray-200 flex items-center justify-center transition-colors relative flex-shrink-0"
                        style={{ zIndex: 1001 }}
                      >
                        <svg className="w-5 h-5 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                        </svg>
                      </button>
                    </div>
                    {showMenuId === chat.id && (
                      <div 
                        className="absolute bg-white rounded-lg shadow-2xl border border-gray-200 py-1 right-2"
                        style={{ 
                          minWidth: '120px',
                          zIndex: 1002,
                          position: 'absolute',
                          top: '56px'
                        }}
                        onClick={(e) => e.stopPropagation()}
                        onMouseEnter={() => setShowMenuId(chat.id)}
                        onMouseLeave={() => {
                          setTimeout(() => setShowMenuId(null), 200);
                        }}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteChat(chat.id, e);
                          }}
                          className="w-full px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 text-left transition-colors"
                        >
                          Sil
                        </button>
                      </div>
                    )}
                  </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="p-6 border-t border-gray-200/50 space-y-3">
            {/* Ayarlar Butonu */}
            <button
              onClick={() => setShowSettings(true)}
              className="w-full rounded-2xl border border-gray-200/50 hover:border-gray-300 bg-white/50 hover:bg-gray-50 backdrop-blur-sm text-left hover:shadow-md transition-all duration-200"
              style={{ 
                padding: '16px',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)'
              }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <div className="font-medium text-gray-700" style={{ fontSize: '16px', lineHeight: '1.4' }}>
                    ⚙️ Ayarlar
                  </div>
                </div>
              </div>
            </button>

            {/* Kullanıcı Profili */}
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-lg" style={{ boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)' }}>
                H
              </div>
              <div>
                <div className="text-base font-semibold text-gray-800">Halit</div>
                <div className="text-sm text-gray-500">İSTE Öğrencisi</div>
              </div>
            </div>
          </div>
        </div>

        {/* Ana Chat Alanı */}
        <div className="flex-1 flex flex-col bg-white/60 backdrop-blur-xl rounded-l-3xl border-l border-gray-200/50" style={{ flex: 1, width: 'calc(100% - 280px)', boxShadow: '-4px 0 30px rgba(0, 0, 0, 0.06)', boxSizing: 'border-box', margin: 0, padding: 0, fontFamily: settings.fontFamily }}>
          {/* Header */}
          <div className="bg-white/80 backdrop-blur-xl border-b border-gray-200/50 p-6 shadow-sm rounded-tl-3xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center text-white text-2xl shadow-lg" style={{ boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)' }}>
                  🤖
                </div>
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    İSKENDERUN TEKNİK CHATBOT
                  </h1>
                  <p className="text-sm text-gray-500">Akıllı Üniversite Asistanı</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div
                  className={`w-3 h-3 rounded-full ${
                    apiStatus === "online"
                      ? "bg-green-500 animate-pulse"
                      : apiStatus === "offline"
                      ? "bg-gray-500"
                      : "bg-yellow-500"
                  }`}
                  style={{ boxShadow: '0 0 12px currentColor' }}
                />
                <span className="text-base text-gray-600 font-medium">
                  {apiStatus === "online"
                    ? "Çevrimiçi"
                    : apiStatus === "offline"
                    ? "Çevrimdışı"
                    : "Kontrol ediliyor..."}
                </span>
              </div>
            </div>
          </div>

          {/* Mesajlar */}
          <div className="flex-1 overflow-y-auto" style={{ paddingTop: '24px', paddingBottom: '80px', paddingLeft: '40px', paddingRight: '40px' }}>
            <div className="w-full max-w-none mx-auto" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {messages.map((m) => {
                // Eğer bu mesaj typing durumundaysa, typing text'i göster
                const displayText = (m.id === typingMessageId && typingText) ? typingText : m.text;
                return (
                  <MessageBubble
                    key={m.id}
                    from={m.from}
                    time={timeOf(m.timestamp)}
                    settings={settings}
                  >
                    {displayText}
                  </MessageBubble>
                );
              })}
              
              {/* Sık Sorulan Sorular - Sadece ilk mesajdan sonra ve kullanıcı mesajı yoksa göster */}
              {messages.length === 1 && messages[0]?.from === "bot" && !messages.some(m => m.from === "user") && (
                <div 
                  className="flex justify-start animate-fadeIn" 
                  style={{ marginLeft: '20px', width: '100%', display: 'flex', justifyContent: 'flex-start', marginTop: '8px' }}
                >
                  <div 
                    className="rounded-[14px] shadow-lg"
                    style={{ 
                      backgroundColor: settings?.botMessageColor || '#A5C9CA',
                      boxShadow: '0 2px 6px rgba(0, 0, 0, 0.08)',
                      padding: '16px 18px',
                      maxWidth: '70%',
                      lineHeight: '1.5',
                    }}
                  >
                    <h3 className="text-base font-semibold text-gray-800 mb-3" style={{ fontSize: '16px', marginBottom: '12px' }}>
                      💡 Sık Sorulan Sorular
                    </h3>
                    <div className="space-y-2">
                      <button
                        onClick={() => sendQuickQuestion("İSTE nerededir")}
                        className="w-full text-left px-3 py-2 bg-white/60 hover:bg-white/80 rounded-lg transition-all duration-200 hover:shadow-sm"
                        style={{ fontSize: '14px', color: '#1f2937', fontWeight: '500' }}
                      >
                        📍 İSTE nerededir
                      </button>
                      <button
                        onClick={() => sendQuickQuestion("Rektörün ismi")}
                        className="w-full text-left px-3 py-2 bg-white/60 hover:bg-white/80 rounded-lg transition-all duration-200 hover:shadow-sm"
                        style={{ fontSize: '14px', color: '#1f2937', fontWeight: '500' }}
                      >
                        👤 Rektörün ismi
                      </button>
                      <button
                        onClick={() => sendQuickQuestion("Bilgisayar mühendisliği ana sayfa")}
                        className="w-full text-left px-3 py-2 bg-white/60 hover:bg-white/80 rounded-lg transition-all duration-200 hover:shadow-sm"
                        style={{ fontSize: '14px', color: '#1f2937', fontWeight: '500' }}
                      >
                        💻 Bilgisayar mühendisliği ana sayfa
                      </button>
                    </div>
                  </div>
                </div>
              )}
              
              {isTyping && !typingMessageId && (
                <MessageBubble from="bot" time={timeOf(new Date())} typing settings={settings} />
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input */}
          <div className="bg-white/80 backdrop-blur-xl border-t border-gray-200/50 shadow-lg rounded-bl-3xl" style={{ padding: '15px', margin: '15px' }}>
            <div className="w-full">
              <div className="relative bg-white rounded-xl border border-gray-200/50 shadow-xl flex items-center gap-4" style={{ boxShadow: '0 8px 24px rgba(0, 0, 0, 0.08)', height: '50px', padding: '10px 15px', boxSizing: 'border-box', display: 'flex', alignItems: 'center' }}>
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Lütfen mesajınızı yazın..."
                  rows={1}
                  className="flex-1 bg-transparent text-gray-800 placeholder-gray-400 resize-none outline-none"
                  style={{ fontSize: '16px', lineHeight: '1.5', border: 'none', padding: '0', margin: '0', height: '30px', maxHeight: '200px', overflowY: 'auto' }}
                />
                <button
                  onClick={handleMicrophoneClick}
                  className={`w-12 h-12 rounded-full transition-all duration-300 flex items-center justify-center shadow-md hover:shadow-lg hover:scale-110 active:scale-95 ${
                    isListening 
                      ? 'bg-red-100 hover:bg-red-200 text-red-600 animate-pulse' 
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-700'
                  }`}
                  style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)' }}
                  title={isListening ? 'Ses tanıma durdur' : 'Sesli mesaj yaz'}
                >
                  <svg
                    className="w-6 h-6"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                  </svg>
                </button>
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || isTyping}
                  className={`w-12 h-12 rounded-full transition-all duration-300 flex items-center justify-center ${
                    input.trim() && !isTyping
                      ? "bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl hover:scale-110 active:scale-95"
                      : "bg-gray-200 text-gray-400 cursor-not-allowed"
                  }`}
                  style={input.trim() && !isTyping ? { boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)' } : {}}
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Ayarlar Modal */}
      {showSettings && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setShowSettings(false)}
        >
          <div 
            className="bg-white/95 backdrop-blur-lg rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
            style={{ fontFamily: settings.fontFamily }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-800">Ayarlar</h2>
              <button
                onClick={() => setShowSettings(false)}
                className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
              >
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-6">
              {/* Renk Kategorisi Seçimi */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Renk Kategorisi Seç
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setColorCategory('background')}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${
                      colorCategory === 'background'
                        ? 'bg-blue-500 text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Arka Plan
                  </button>
                  <button
                    onClick={() => setColorCategory('bot')}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${
                      colorCategory === 'bot'
                        ? 'bg-blue-500 text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    ChatBot
                  </button>
                  <button
                    onClick={() => setColorCategory('user')}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${
                      colorCategory === 'user'
                        ? 'bg-blue-500 text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Kullanıcı
                  </button>
                </div>
              </div>

              {/* Renk Seçimi (Dinamik) */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {colorCategory === 'background' && 'Arka Plan Rengi'}
                  {colorCategory === 'bot' && 'ChatBot Mesaj Rengi'}
                  {colorCategory === 'user' && 'Kullanıcı Mesaj Rengi'}
                </label>
                <div className="flex justify-center">
                  <div className="grid grid-cols-5 gap-2 overflow-y-auto max-h-64 pr-2" style={{ maxHeight: '256px', width: 'fit-content' }}>
                    {[
                    // Açık Tonlar (20 renk)
                    '#f9edfa', '#EAF4F4', '#F6F8FB', '#ab9bf2', '#1E1E2F', '#FFE5E5', '#FFF4E5', '#F0FFE5', '#E5F5FF', '#F5E5FF',
                    '#FFF8E5', '#E5FFE5', '#FFE5F5', '#E5E5FF', '#F5FFE5', '#FFFFFF', '#F8F8F8', '#F0F0F0', '#E8E8E8', '#E0E0E0',
                    // Sıcak Renkler (20 renk)
                    '#F54927', '#FFA596', '#FAA839', '#E0DB58', '#FF6B6B', '#FF8787', '#FFA07A', '#FF7F50', '#FF6347', '#FF4500',
                    '#FFD700', '#FFA500', '#FF8C00', '#FF7F00', '#FF6A00', '#FF4D00', '#FF3333', '#FF0000', '#DC143C', '#B22222',
                    // Soğuk Renkler (20 renk)
                    '#54DEE8', '#A5C9CA', '#3A6FF7', '#4ECDC4', '#45B7D1', '#96CEB4', '#4ADE80', '#00CED1', '#00BFFF', '#1E90FF',
                    '#4169E1', '#6495ED', '#87CEEB', '#B0E0E6', '#ADD8E6', '#48CAE4', '#0096C7', '#023E8A', '#0077BE', '#005F87',
                    // Mor-Pembe Tonları (15 renk)
                    '#8987C9', '#B787C9', '#BA5261', '#d3b5e8', '#9B59B6', '#8E44AD', '#7B68EE', '#9370DB', '#BA55D3', '#DA70D6',
                    '#FF1493', '#FF69B4', '#FFB6C1', '#FFC0CB', '#EC4899',
                    // Yeşil Tonları (10 renk)
                    '#6A994E', '#A7C957', '#32CD32', '#228B22', '#008000', '#00FF00', '#90EE90', '#98FB98', '#7FFF00', '#ADFF2F',
                    // Koyu Tonlar (10 renk)
                    '#003049', '#D62828', '#E74C3C', '#C0392B', '#A93226', '#922B21', '#7B241C', '#641E16', '#512E5F', '#4A235A',
                    // Turuncu-Sarı Tonları (5 renk)
                    '#F77F00', '#FCBF49', '#EAE2B7', '#DDA15E', '#F59E0B',
                    // Gri Tonları (5 renk)
                    '#DBC8C8', '#C0C0C0', '#A9A9A9', '#808080', '#696969',
                    // Ekstra Renkler (15 renk)
                    '#FF6E8D', '#E7AB9A', '#9DB8E0', '#E67E9E', '#BC4749', '#FFEAA7', '#DDA15E', '#FFA07A', '#20B2AA', '#4682B4',
                    '#6B8E23', '#CD5C5C', '#F08080', '#98D8C8', '#F7DC6F'
                  ].map((color) => {
                    const currentColor = colorCategory === 'background' 
                      ? settings.backgroundColor 
                      : colorCategory === 'bot' 
                      ? settings.botMessageColor 
                      : settings.userMessageColor;
                    
                    const isSelected = currentColor === color;
                    
                    return (
                      <button
                        key={color}
                        onClick={() => {
                          if (colorCategory === 'background') {
                            setSettings(prev => ({ ...prev, backgroundColor: color }));
                          } else if (colorCategory === 'bot') {
                            setSettings(prev => ({ ...prev, botMessageColor: color }));
                          } else {
                            setSettings(prev => ({ ...prev, userMessageColor: color }));
                          }
                        }}
                        className={`w-12 h-12 rounded-lg border-2 transition-all ${
                          isSelected ? 'border-blue-500 scale-110' : 'border-gray-300'
                        }`}
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    );
                    })}
                  </div>
                </div>
                <input
                  type="color"
                  value={colorCategory === 'background' 
                    ? settings.backgroundColor 
                    : colorCategory === 'bot' 
                    ? settings.botMessageColor 
                    : settings.userMessageColor}
                  onChange={(e) => {
                    const color = e.target.value;
                    if (colorCategory === 'background') {
                      setSettings(prev => ({ ...prev, backgroundColor: color }));
                    } else if (colorCategory === 'bot') {
                      setSettings(prev => ({ ...prev, botMessageColor: color }));
                    } else {
                      setSettings(prev => ({ ...prev, userMessageColor: color }));
                    }
                  }}
                  className="mt-2 w-full h-10 rounded-lg cursor-pointer"
                />
              </div>

              {/* Yazı Tipi */}
              <div>
                <label className="block text-center text-xl font-bold text-gray-800 mb-4" style={{ fontFamily: settings.fontFamily }}>
                  Yazı Tipi
                </label>
                <select
                  value={settings.fontFamily}
                  onChange={(e) => setSettings(prev => ({ ...prev, fontFamily: e.target.value }))}
                  className="w-full px-6 py-4 border-2 border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-lg hover:shadow-xl bg-white text-gray-800 font-semibold"
                  style={{ fontFamily: settings.fontFamily, fontSize: '18px' }}
                >
                  <option value="Inter">Inter (Varsayılan)</option>
                  <option value="Arial">Arial</option>
                  <option value="Georgia">Georgia (Serif)</option>
                  <option value="Times New Roman">Times New Roman (Serif)</option>
                  <option value="Courier New">Courier New (Monospace)</option>
                  <option value="Comic Sans MS">Comic Sans MS</option>
                  <option value="Verdana">Verdana</option>
                  <option value="Trebuchet MS">Trebuchet MS</option>
                </select>
              </div>

              {/* Varsayılana Dön */}
              <button
                onClick={() => {
                  setSettings({
                    backgroundColor: '#f9edfa',
                    botMessageColor: '#A5C9CA',
                    userMessageColor: '#E7AB9A',
                    fontFamily: 'Inter'
                  });
                }}
                className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 font-medium transition-colors"
              >
                Varsayılana Dön
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* === Mesaj Bileşeni === */
const MessageBubble = memo(function MessageBubble({ from, children, time, typing = false, settings = null }) {
  const isUser = from === "user";

  return (
    <div
      className={`flex ${
        isUser ? "justify-end" : "justify-start"
      }`}
      style={isUser ? { marginRight: '20px', width: '100%', display: 'flex', justifyContent: 'flex-end' } : { marginLeft: '20px', width: '100%', display: 'flex', justifyContent: 'flex-start' }}
    >
      <div
        className={`rounded-[14px] shadow-lg`}
        style={isUser 
          ? { 
              backgroundColor: settings?.userMessageColor || '#E7AB9A',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.08)',
              padding: '12px 18px',
              maxWidth: '70%',
              lineHeight: '1.5',
              display: 'flex',
              alignItems: 'center',
              alignSelf: 'flex-end'
            }
          : { 
              backgroundColor: settings?.botMessageColor || '#A5C9CA',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.08)',
              padding: '12px 18px',
              maxWidth: '70%',
              lineHeight: '1.5',
              display: 'flex',
              alignItems: 'center',
              alignSelf: 'flex-start'
            }
        }
      >
        <div className="flex items-center gap-3" style={{ width: '100%' }}>
          {!isUser && (
            <div className="w-12 h-12 bg-white/30 rounded-full flex items-center justify-center text-white text-xl shrink-0 shadow-md flex-shrink-0">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
              </svg>
            </div>
          )}
          <div className="flex-1 min-w-0" style={{ textAlign: 'left', fontFamily: settings?.fontFamily || 'Inter' }}>
            {typing ? (
              <TypingDots />
            ) : (
              <div className="whitespace-pre-wrap break-words" style={{ fontSize: '15.5px', fontWeight: 600, lineHeight: '1.5', color: '#000', fontFamily: settings?.fontFamily || 'Inter' }}>
                {parseMessage(children)}
              </div>
            )}
            <div
              className={`mt-2 text-xs text-right`}
              style={{ color: '#333', fontFamily: settings?.fontFamily || 'Inter' }}
            >
              {time}
            </div>
          </div>
          {isUser && (
            <div className="w-12 h-12 bg-white/30 rounded-full flex items-center justify-center text-white text-xl font-bold shrink-0 shadow-md flex-shrink-0">
              H
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

/* === Yazıyor... animasyonu === */
function TypingDots() {
  return (
    <div className="flex items-center gap-2">
      <div className="w-3 h-3 bg-blue-400 rounded-full animate-bounce" />
      <div
        className="w-3 h-3 bg-blue-400 rounded-full animate-bounce"
        style={{ animationDelay: "0.1s" }}
      />
      <div
        className="w-3 h-3 bg-blue-400 rounded-full animate-bounce"
        style={{ animationDelay: "0.2s" }}
      />
    </div>
  );
}
