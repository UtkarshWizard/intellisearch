import { supabase } from "@/lib/client";
import { BACKEND_URL } from "@/lib/config";
import type { User } from "@supabase/supabase-js";
import axios from "axios";
import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router";
import {
    Search,
    Plus,
    LogOut,
    Compass,
    Globe,
    BookOpen,
    Send,
    MessageSquare,
    Moon,
    Sun,
    Menu,
    X,
    ChevronRight,
    ArrowRight,
    Sparkles,
    User as UserIcon,
    ExternalLink
} from "lucide-react";

interface ConversationHistory {
    id: string;
    slug: string;
    messages: {
        id: string;
        content: string;
        role: "USER" | "ASSISTANT";
        createdAt: string;
    }[];
}

// Simple markdown formatter function that handles bold (**), italics (*), bullet lists (- or *), links ([text](url)) and spacing.
function formatMarkdown(text: string) {
    if (!text) return "";

    // Escape HTML tags to prevent injections but keep our formatting tags
    let clean = text.replace(/</g, "&lt;").replace(/>/g, "&gt;");

    // We want to recover the format tags we specifically use or expect from the API (like <question>)
    clean = clean.replace(/&lt;question&gt;/g, "<question>").replace(/&lt;\/question&gt;/g, "</question>");
    clean = clean.replace(/&lt;ANSWER&gt;/g, "<ANSWER>").replace(/&lt;\/ANSWER&gt;/g, "</ANSWER>");
    clean = clean.replace(/&lt;FOLLOW_UPS&gt;/g, "<FOLLOW_UPS>").replace(/&lt;\/FOLLOW_UPS&gt;/g, "</FOLLOW_UPS>");

    // Bold formatting: **text**
    clean = clean.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

    // Italics formatting: *text*
    clean = clean.replace(/\*(.*?)\*/g, "<em>$1</em>");

    // Links: [label](url)
    clean = clean.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-orange-600 dark:text-orange-400 hover:underline inline-flex items-center gap-1">$1 <svg class="w-3 h-3 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg></a>');

    // Bullet points: lines starting with "- " or "* "
    const lines = clean.split("\n");
    const formattedLines = lines.map(line => {
        const trimmed = line.trim();
        if (trimmed.startsWith("- ")) {
            return `<li class="ml-4 list-disc dark:text-slate-300 my-1">${trimmed.substring(2)}</li>`;
        }
        if (trimmed.startsWith("* ") && !trimmed.endsWith("*")) {
            return `<li class="ml-4 list-disc dark:text-slate-300 my-1">${trimmed.substring(2)}</li>`;
        }
        return line;
    });

    return formattedLines.join("\n");
}

export default function Conversation() {
    const [user, setUser] = useState<User | null>(null);
    const [conversations, setConversations] = useState<ConversationHistory[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(true);
    const [activeConversation, setActiveConversation] = useState<ConversationHistory | null>(null);
    const [query, setQuery] = useState("");
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isDarkMode, setIsDarkMode] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    
    // Rename and Delete state
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState("");
    const [isStopped, setIsStopped] = useState(false);

    // Streaming response state
    const [streamingAnswer, setStreamingAnswer] = useState("");
    const [streamingSources, setStreamingSources] = useState<{ url: string }[]>([]);
    const [isFetchingActive, setIsFetchingActive] = useState(false);

    const abortControllerRef = useRef<AbortController | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const followUpTextareaRef = useRef<HTMLTextAreaElement>(null);

    const navigate = useNavigate();
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Auto-growing textarea handler
    const adjustTextareaHeight = (element: HTMLTextAreaElement | null) => {
        if (!element) return;
        element.style.height = "auto";
        element.style.height = `${element.scrollHeight}px`;
    };

    useEffect(() => {
        adjustTextareaHeight(textareaRef.current);
    }, [query]);

    useEffect(() => {
        adjustTextareaHeight(followUpTextareaRef.current);
    }, [query]);

    useEffect(() => {
        // Read theme settings on boot
        const isDark = document.documentElement.classList.contains("dark");
        setIsDarkMode(isDark);

        async function getInfo() {
            const { data } = await supabase.auth.getUser();
            if (data.user) {
                setUser(data.user);
            } else {
                navigate("/auth");
            }
        }
        getInfo();
    }, [navigate]);

    const fetchConversations = async () => {
        if (!user) return;
        setIsLoadingHistory(true);
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            const res = await axios.get(`${BACKEND_URL}/conversations`, {
                headers: { "Authorization": `${token}` }
            });
            if (res.data.conversations) {
                // Sort history from latest to oldest
                const sorted = [...res.data.conversations].sort((a, b) => {
                    const timeA = a.messages?.[0]?.createdAt || "";
                    const timeB = b.messages?.[0]?.createdAt || "";
                    return new Date(timeB).getTime() - new Date(timeA).getTime();
                });
                setConversations(sorted);
            }
        } catch (e) {
            console.error("Error fetching conversations:", e);
        } finally {
            setIsLoadingHistory(false);
        }
    };

    useEffect(() => {
        if (user) {
            fetchConversations();
        }
    }, [user]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [activeConversation, streamingAnswer]);

    const handleSelectConversation = async (id: string) => {
        // Find existing basic conversation details in history to switch selection instantly
        const existing = conversations.find(c => c.id === id);
        if (existing) {
            setActiveConversation({
                ...existing,
                messages: existing.messages || [] // Fallback placeholder
            });
        }
        setStreamingAnswer("");
        setStreamingSources([]);
        setIsStopped(false);
        setIsFetchingActive(true);

        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            const res = await axios.get(`${BACKEND_URL}/conversations/${id}`, {
                headers: { "Authorization": `${token}` }
            });
            if (res.data.conversation) {
                setActiveConversation(res.data.conversation);
            }
        } catch (e) {
            console.error("Error loading conversation:", e);
        } finally {
            setIsFetchingActive(false);
        }
    };

    const handleNewConversation = () => {
        setActiveConversation(null);
        setStreamingAnswer("");
        setStreamingSources([]);
        setQuery("");
        setIsStopped(false);
    };

    const toggleTheme = () => {
        const root = document.documentElement;
        if (isDarkMode) {
            root.classList.remove("dark");
            root.classList.add("light");
            setIsDarkMode(false);
        } else {
            root.classList.remove("light");
            root.classList.add("dark");
            setIsDarkMode(true);
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate("/auth");
    };

    const handleDeleteConversation = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm("Are you sure you want to delete this thread?")) return;

        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            await axios.delete(`${BACKEND_URL}/conversations/${id}`, {
                headers: { "Authorization": `${token}` }
            });
            if (activeConversation?.id === id) {
                handleNewConversation();
            }
            fetchConversations();
        } catch (err) {
            console.error("Error deleting conversation:", err);
        }
    };

    const handleStartRename = (id: string, currentSlug: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingId(id);
        setEditValue(currentSlug.replace(/-/g, " "));
    };

    const handleSaveRename = async (id: string) => {
        if (!editValue.trim()) {
            setEditingId(null);
            return;
        }

        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            const updatedSlug = editValue.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-");
            await axios.put(`${BACKEND_URL}/conversations/${id}`, {
                slug: updatedSlug
            }, {
                headers: { "Authorization": `${token}` }
            });
            setEditingId(null);
            if (activeConversation?.id === id) {
                setActiveConversation(prev => prev ? { ...prev, slug: updatedSlug } : null);
            }
            fetchConversations();
        } catch (err) {
            console.error("Error renaming conversation:", err);
            setEditingId(null);
        }
    };

    const handleStopRequest = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            setIsLoading(false);
            setIsStopped(true);
        }
    };

    const handleQuerySubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim() || isLoading) return;

        setIsLoading(true);
        setStreamingAnswer("");
        setStreamingSources([]);
        setIsStopped(false);

        const originalQuery = query;
        setQuery("");

        // Setup abort controller
        abortControllerRef.current = new AbortController();

        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;

            // Build the request URL depending on whether we are starting new or continuing
            const isFollowUp = activeConversation !== null;
            const endpoint = isFollowUp
                ? `${BACKEND_URL}/conversation/follow_up`
                : `${BACKEND_URL}/conversation`;

            const body = isFollowUp
                ? { conversationId: activeConversation.id, query: originalQuery }
                : { query: originalQuery };

            // Add placeholder USER message to UI instantly
            setActiveConversation(prev => {
                const dummyMsg = {
                    id: Math.random().toString(),
                    role: "USER" as const,
                    content: originalQuery,
                    createdAt: new Date().toISOString()
                };
                if (!prev) {
                    return {
                        id: "temp-id",
                        slug: "new-thread",
                        userId: user?.id || "",
                        createdAt: new Date().toISOString(),
                        messages: [dummyMsg]
                    };
                }
                return {
                    ...prev,
                    messages: [
                        ...prev.messages,
                        dummyMsg
                    ]
                };
            });

            const response = await fetch(endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": token || ""
                },
                body: JSON.stringify(body),
                signal: abortControllerRef.current.signal
            });

            if (response.status === 429) {
                const errData = await response.json();
                setStreamingAnswer(errData.error || "Rate limit exceeded. Please try again later.");
                setIsLoading(false);
                return;
            }

            if (!response.body) {
                throw new Error("No response body");
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let rawData = "";

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                rawData += chunk;

                // Split by sources delimiter if it exists
                if (rawData.includes("<SOURCES>")) {
                    const parts = rawData.split("<SOURCES>");
                    const answerPart = parts[0] || "";
                    setStreamingAnswer(answerPart.replace(/<ANSWER>/g, "").replace(/<\/ANSWER>/g, ""));

                    const sourcesPart = parts[1]?.split("</SOURCES>")[0] || "";
                    try {
                        const parsedSources = JSON.parse(sourcesPart);
                        setStreamingSources(parsedSources);
                    } catch {
                        // Incomplete JSON or other chunks
                    }
                } else {
                    setStreamingAnswer(rawData.replace(/<ANSWER>/g, "").replace(/<\/ANSWER>/g, ""));
                }
            }

            // Once streamed successfully, re-fetch sidebar conversation list (slug/title updates etc.)
            fetchConversations(); // fire-and-forget, no await needed here

            if (!isFollowUp) {
                // New conversation: fetch list to find the newly created ID, then select it.
                // We pre-populate state so handleSelectConversation won't flash a skeleton.
                const token2 = (await supabase.auth.getSession()).data.session?.access_token;
                const freshRes = await axios.get(`${BACKEND_URL}/conversations`, {
                    headers: { "Authorization": `${token2}` }
                });
                const list = freshRes.data.conversations || [];
                if (list.length > 0) {
                    const sorted = [...list].sort((a: ConversationHistory, b: ConversationHistory) => {
                        const timeA = a.messages?.[0]?.createdAt || "";
                        const timeB = b.messages?.[0]?.createdAt || "";
                        return new Date(timeB).getTime() - new Date(timeA).getTime();
                    });
                    const newest = sorted[0];
                    if (newest) {
                        // Silently update the conversation id/slug without re-fetching messages
                        setActiveConversation(prev => prev ? { ...prev, id: newest.id, slug: newest.slug } : prev);
                        // Background-fetch full conversation to sync DB messages (no skeleton shown)
                        const token3 = (await supabase.auth.getSession()).data.session?.access_token;
                        axios.get(`${BACKEND_URL}/conversations/${newest.id}`, {
                            headers: { "Authorization": `${token3}` }
                        }).then(res => {
                            if (res.data.conversation) {
                                setActiveConversation(res.data.conversation);
                                setStreamingAnswer("");
                                setStreamingSources([]);
                            }
                        }).catch(console.error);
                    }
                }
            } else {
                // Follow-up: append the streamed assistant message directly to local state.
                // No re-fetch, no skeleton — the user already sees the answer.
                // Extract just the answer portion (before the <SOURCES> delimiter)
                const answerOnly = rawData.includes("<SOURCES>")
                    ? rawData.split("<SOURCES>")[0] || ""
                    : rawData;
                // Capture sources from state at this moment
                const currentSources = streamingSources;
                const assistantMsg = {
                    id: Math.random().toString(),
                    role: "ASSISTANT" as const,
                    content: JSON.stringify({ answer: answerOnly, sources: currentSources }),
                    createdAt: new Date().toISOString()
                };
                setActiveConversation(prev => prev ? {
                    ...prev,
                    messages: [...prev.messages, assistantMsg]
                } : prev);
                setStreamingAnswer("");
                setStreamingSources([]);
            }

        } catch (err) {
            if ((err as Error).name === "AbortError") {
                console.log("Stream aborted");
            } else {
                console.error("Error streaming response:", err);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const renderMessageContent = (msg: { role: "USER" | "ASSISTANT"; content: string }) => {
        if (msg.role === "USER") {
            return <p className="text-[#0B0D0E] dark:text-white text-lg font-medium tracking-tight leading-relaxed">{msg.content}</p>;
        }

        try {
            const parsed = JSON.parse(msg.content);
            const answer = parsed.answer || "";
            const sources: { url: string }[] = parsed.sources || [];

            // Simple parser to pull out actual content and follow up questions
            let cleanAnswer = answer;
            let followUps: string[] = [];

            if (answer.includes("<FOLLOW_UPS>")) {
                const parts = answer.split("<FOLLOW_UPS>");
                cleanAnswer = (parts[0] || "").replace(/<ANSWER>/g, "").replace(/<\/ANSWER>/g, "").trim();
                const followUpsRaw = parts[1]?.split("</FOLLOW_UPS>")[0] || "";

                // Extract questions
                const matches = followUpsRaw.match(/<question>(.*?)<\/question>/g);
                if (matches) {
                    followUps = matches.map((m: string) => m.replace(/<\/?question>/g, ""));
                }
            } else {
                cleanAnswer = answer.replace(/<ANSWER>/g, "").replace(/<\/ANSWER>/g, "").trim();
            }

            const formatted = formatMarkdown(cleanAnswer);

            return (
                <div className="space-y-6">
                    {/* Answer text */}
                    <div
                        className="prose dark:prose-invert max-w-none text-slate-800 dark:text-slate-200 leading-relaxed space-y-4"
                        dangerouslySetInnerHTML={{ __html: formatted }}
                    />

                    {/* Sources Section directly after answer and before follow ups */}
                    {sources.length > 0 && (
                        <div className="pt-4 border-t border-slate-200 dark:border-[#2D3135]">
                            <div className="flex items-center gap-2 text-xs font-semibold text-orange-600 dark:text-orange-400/80 mb-3 uppercase tracking-wider">
                                <BookOpen className="w-3.5 h-3.5" />
                                Sources
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {sources.map((src, index) => {
                                    let domain = "Web Source";
                                    try {
                                        domain = new URL(src.url).hostname.replace("www.", "");
                                    } catch { }
                                    return (
                                        <a
                                            key={index}
                                            href={src.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-3 bg-slate-50 dark:bg-[#191C1E] hover:bg-slate-100 dark:hover:bg-[#222629] border border-slate-200 dark:border-[#2D3135] rounded-xl flex items-center justify-between gap-2 group transition duration-150"
                                        >
                                            <span className="text-xs text-slate-700 dark:text-slate-300 font-medium truncate max-w-[80%]">
                                                {domain}
                                            </span>
                                            <ExternalLink className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition" />
                                        </a>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Follow ups suggestions */}
                    {followUps.length > 0 && (
                        <div className="pt-4 border-t border-slate-200 dark:border-[#2D3135] space-y-2">
                            <span className="text-lg text-slate-500 font-medium">Follow-Ups</span>
                            <div className="flex flex-col gap-2">
                                {followUps.map((question, i) => (
                                    <button
                                        key={i}
                                        onClick={() => {
                                            setQuery(question);
                                        }}
                                        className="text-left py-2 px-3 hover:bg-slate-50 dark:hover:bg-[#191C1E] border border-transparent hover:border-slate-200 dark:hover:border-[#2D3135] text-sm text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 rounded-lg flex items-center justify-between transition duration-150 group cursor-pointer"
                                    >
                                        <span>{question}</span>
                                        <ChevronRight className="w-4 h-4 text-orange-500 opacity-0 group-hover:opacity-100 transition" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            );
        } catch {
            // Raw text message fallback
            let clean = msg.content;
            if (clean.includes("<FOLLOW_UPS>")) {
                clean = clean.split("<FOLLOW_UPS>")[0] || "";
            }
            clean = clean.replace(/<ANSWER>/g, "").replace(/<\/ANSWER>/g, "").trim();
            const formatted = formatMarkdown(clean);
            return (
                <div
                    className="prose dark:prose-invert max-w-none text-slate-800 dark:text-slate-200 leading-relaxed space-y-4"
                    dangerouslySetInnerHTML={{ __html: formatted }}
                />
            );
        }
    };

    return (
        <div className="flex h-screen bg-white dark:bg-[#0B0D0E] text-slate-900 dark:text-slate-100 font-sans overflow-hidden">
            {/* Sidebar (Fixed Height and sticky/non-scrolling) */}
            <div className={`fixed inset-y-0 left-0 z-30 w-64 bg-slate-50 dark:bg-[#111315] border-r border-slate-200 dark:border-[#212427] flex flex-col justify-between transform transition-transform duration-200 ease-in-out lg:relative lg:translate-x-0 h-screen overflow-hidden ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
                <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
                    <div className="p-4 flex items-center justify-between border-b border-slate-200 dark:border-[#212427]">
                        <span className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <Compass className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                            IntelliSearch
                        </span>
                        <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-md">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="p-3">
                        <button
                            onClick={handleNewConversation}
                            className="w-full py-2.5 px-4 bg-orange-600/10 hover:bg-orange-600/20 dark:bg-orange-500/10 dark:hover:bg-orange-500/20 text-orange-600 dark:text-orange-400 font-medium rounded-lg flex items-center justify-center gap-2 border border-orange-600/20 dark:border-orange-500/20 transition duration-150 cursor-pointer"
                        >
                            <Plus className="w-4 h-4" />
                            New Thread
                        </button>
                    </div>

                    {/* Scrollable list of threads */}
                    <div className="flex-1 overflow-y-auto px-3 space-y-1 py-2">
                        <div className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase px-2 mb-2 tracking-wider">Library</div>

                        {isLoadingHistory ? (
                            // Skeleton placeholders
                            <div className="space-y-2 px-2">
                                <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse" />
                                <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse w-5/6" />
                                <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse w-4/5" />
                            </div>
                        ) : conversations.length === 0 ? (
                            <div className="text-xs text-slate-500 px-2 py-4">No threads yet.</div>
                        ) : (
                            conversations.map((conv) => (
                                <div
                                    key={conv.id}
                                    className={`w-full text-left py-2 px-3 rounded-lg flex items-center justify-between transition group cursor-pointer ${activeConversation?.id === conv.id ? "bg-slate-200 dark:bg-[#1C1F22] text-slate-900 dark:text-white" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#15181A] hover:text-slate-900 dark:hover:text-slate-200"}`}
                                    onClick={() => handleSelectConversation(conv.id)}
                                >
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <MessageSquare className="w-4 h-4 flex-shrink-0 text-slate-400 dark:text-slate-500 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition" />
                                        {editingId === conv.id ? (
                                            <input
                                                type="text"
                                                value={editValue}
                                                onChange={(e) => setEditValue(e.target.value)}
                                                onBlur={() => handleSaveRename(conv.id)}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") handleSaveRename(conv.id);
                                                    if (e.key === "Escape") setEditingId(null);
                                                }}
                                                onClick={(e) => e.stopPropagation()}
                                                className="bg-white dark:bg-[#1C1F22] border border-orange-500 rounded px-1.5 py-0.5 text-sm w-full outline-none text-slate-900 dark:text-white"
                                                autoFocus
                                            />
                                        ) : (
                                            <span className="truncate text-sm font-medium">
                                                {conv.slug ? conv.slug.replace(/-/g, " ") : "Untitled Thread"}
                                            </span>
                                        )}
                                    </div>
                                    {editingId !== conv.id && (
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition ml-2">
                                            <button
                                                onClick={(e) => handleStartRename(conv.id, conv.slug || "", e)}
                                                className="p-1 text-slate-400 hover:text-orange-500 hover:bg-slate-300/50 dark:hover:bg-slate-800 rounded transition cursor-pointer"
                                                title="Rename"
                                            >
                                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z"></path></svg>
                                            </button>
                                            <button
                                                onClick={(e) => handleDeleteConversation(conv.id, e)}
                                                className="p-1 text-slate-400 hover:text-red-500 hover:bg-slate-300/50 dark:hover:bg-slate-800 rounded transition cursor-pointer"
                                                title="Delete"
                                            >
                                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Sidebar Footer */}
                <div className="p-4 border-t border-slate-200 dark:border-[#212427] space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500 truncate max-w-[70%]">{user?.email}</span>
                        <button
                            onClick={toggleTheme}
                            className="p-1.5 bg-slate-200 dark:bg-[#1C1F22] hover:bg-slate-300 dark:hover:bg-[#252A2D] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg transition cursor-pointer"
                        >
                            {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
                        </button>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="w-full py-2 px-3 hover:bg-rose-500/10 text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 text-sm font-medium rounded-lg flex items-center gap-2.5 transition cursor-pointer"
                    >
                        <LogOut className="w-4 h-4" />
                        Log out
                    </button>
                </div>
            </div>

            {/* Mobile Header Menu Button */}
            <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden relative">
                <header className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-[#212427] bg-white/80 dark:bg-[#0B0D0E]/80 backdrop-blur-md sticky top-0 z-20 lg:hidden">
                    <button onClick={() => setIsSidebarOpen(true)} className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-lg">
                        <Menu className="w-6 h-6" />
                    </button>
                    <span className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Compass className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                        IntelliSearch
                    </span>
                    <button
                        onClick={handleNewConversation}
                        className="p-1.5 bg-slate-100 dark:bg-[#1C1F22] text-slate-700 dark:text-slate-300 rounded-lg"
                    >
                        <Plus className="w-5 h-5" />
                    </button>
                </header>

                {/* Main Content Area */}
                <main className="flex-1 overflow-y-auto px-4 md:px-8 py-8 flex justify-center pb-32">
                    <div className="w-full max-w-3xl flex flex-col justify-between min-h-[80vh]">

                        {/* Empty/Landing State */}
                        {!activeConversation && !streamingAnswer && !isLoading ? (
                            <div className="flex flex-col items-center justify-center flex-1 text-center py-12">
                                <div className="w-16 h-16 bg-orange-600/10 dark:bg-orange-500/10 rounded-2xl flex items-center justify-center border border-orange-600/20 dark:border-orange-500/20 mb-6 animate-pulse">
                                    <Sparkles className="w-8 h-8 text-orange-600 dark:text-orange-400" />
                                </div>
                                <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white mb-3">
                                    Where knowledge begins.
                                </h2>
                                <p className="text-slate-500 dark:text-slate-400 max-w-md mb-8">
                                    Ask anything, and search the entire web for structured real-time answers.
                                </p>

                                {/* Big Search Form */}
                                <form onSubmit={handleQuerySubmit} className="w-full bg-slate-50 dark:bg-[#16181A] border border-slate-200 dark:border-[#2B2F32] rounded-2xl p-2 shadow-2xl relative focus-within:border-orange-500/50 transition-all duration-300">
                                    <textarea
                                        ref={textareaRef}
                                        value={query}
                                        onChange={(e) => setQuery(e.target.value)}
                                        placeholder="Ask, search, clarify..."
                                        rows={1}
                                        className="w-full bg-transparent border-0 outline-none text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 p-3 resize-none text-base min-h-[48px] max-h-[200px]"
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" && !e.shiftKey) {
                                                e.preventDefault();
                                                handleQuerySubmit(e);
                                            }
                                        }}
                                    />
                                    <div className="flex items-center justify-between px-3 py-2 border-t border-slate-200 dark:border-[#232629]">
                                        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                                            <Globe className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                                            <span>Search Pro enabled</span>
                                        </div>
                                        <button
                                            type="submit"
                                            disabled={!query.trim()}
                                            className="p-2 bg-orange-600 dark:bg-orange-500 text-white dark:text-slate-950 font-bold rounded-xl hover:bg-orange-500 dark:hover:bg-orange-400 disabled:opacity-50 disabled:hover:bg-orange-500 transition duration-150 flex items-center justify-center cursor-pointer"
                                        >
                                            <ArrowRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                </form>
                            </div>
                        ) : (

                            /* Chat Feed State */
                            <div className="space-y-8 flex-1 pb-24">
                                {isFetchingActive ? (
                                    <div className="space-y-6">
                                        <div className="flex flex-col gap-4 animate-pulse">
                                            <div className="h-6 bg-slate-200 dark:bg-slate-800 rounded w-1/4 self-end" />
                                            <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded w-2/3" />
                                            <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-5/6" />
                                            <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/2" />
                                        </div>
                                    </div>
                                ) : (
                                    activeConversation?.messages.map((msg, index) => (
                                        <div key={msg.id || index} className="space-y-4">
                                            <div className={`flex items-start gap-4 ${msg.role === "USER" ? "flex-row-reverse" : ""}`}>
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${msg.role === "USER" ? "bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200" : "bg-orange-600/10 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-600/20 dark:border-orange-500/20"}`}>
                                                    {msg.role === "USER" ? <UserIcon className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                                                </div>
                                                <div className={`flex-1 min-w-0 ${msg.role === "USER" ? "text-right" : ""}`}>
                                                    {msg.role === "USER" ? (
                                                        <div className="inline-block bg-slate-100 dark:bg-[#191C1E]/60 p-4 rounded-2xl border border-slate-200 dark:border-[#2D3135]/40 text-left max-w-[85%]">
                                                            {renderMessageContent(msg)}
                                                        </div>
                                                    ) : (
                                                        renderMessageContent(msg)
                                                    )}
                                                </div>
                                            </div>
                                            {index < activeConversation.messages.length - 1 && (
                                                <div className="border-b border-slate-100 dark:border-[#1C1F22] my-8" />
                                            )}
                                        </div>
                                    ))
                                )}

                                {/* Live Streaming Answer Render */}
                                {(isLoading || streamingAnswer || isStopped) && (
                                    <div className="space-y-4 pt-6 border-t border-slate-100 dark:border-[#1C1F22]">
                                        <div className="flex items-start gap-4">
                                            <div className="w-8 h-8 rounded-lg bg-orange-600/10 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-600/20 dark:border-orange-500/20 flex items-center justify-center flex-shrink-0">
                                                <Sparkles className="w-4 h-4 animate-spin-slow" />
                                            </div>
                                            <div className="flex-1 min-w-0 space-y-6">

                                                {/* Streaming text */}
                                                {streamingAnswer && (
                                                    <div
                                                        className="prose dark:prose-invert max-w-none text-slate-800 dark:text-slate-200 leading-relaxed space-y-4"
                                                        dangerouslySetInnerHTML={{
                                                            __html: formatMarkdown(
                                                                streamingAnswer
                                                                    .replace(/<FOLLOW_UPS>[\s\S]*/, "")
                                                                    .replace(/<ANSWER>/g, "")
                                                                    .replace(/<\/ANSWER>/g, "")
                                                                    .trim()
                                                            )
                                                        }}
                                                    />
                                                )}

                                                {/* Streaming Sources directly under answer */}
                                                {streamingSources.length > 0 && (
                                                    <div className="pt-4 border-t border-slate-200 dark:border-[#2D3135]">
                                                        <div className="flex items-center gap-2 text-xs font-semibold text-orange-600 dark:text-orange-400/80 mb-3 uppercase tracking-wider">
                                                            <BookOpen className="w-3.5 h-3.5" />
                                                            Sources
                                                        </div>
                                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                                            {streamingSources.map((src, index) => {
                                                                let domain = "Web Source";
                                                                try {
                                                                    domain = new URL(src.url).hostname.replace("www.", "");
                                                                } catch { }
                                                                return (
                                                                    <a
                                                                        key={index}
                                                                        href={src.url}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="p-3 bg-slate-50 dark:bg-[#191C1E] hover:bg-slate-100 dark:hover:bg-[#222629] border border-slate-200 dark:border-[#2D3135] rounded-xl flex items-center justify-between gap-2 group transition duration-150"
                                                                    >
                                                                        <span className="text-xs text-slate-700 dark:text-slate-300 font-medium truncate max-w-[80%]">
                                                                            {domain}
                                                                        </span>
                                                                        <ExternalLink className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition" />
                                                                    </a>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}

                                                {isLoading && !streamingAnswer && (
                                                    <div className="flex items-center gap-2 text-slate-500">
                                                        <div className="w-2 h-2 rounded-full bg-orange-500 animate-bounce" />
                                                        <div className="w-2 h-2 rounded-full bg-orange-500 animate-bounce delay-100" />
                                                        <div className="w-2 h-2 rounded-full bg-orange-500 animate-bounce delay-200" />
                                                        <span className="text-sm ml-2">Searching the web and generating answer...</span>
                                                    </div>
                                                )}

                                                {isStopped && (
                                                    <div className="text-xs text-rose-500/80 font-medium flex items-center gap-1.5 mt-2">
                                                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
                                                        <span>Generation stopped by user</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <div ref={chatEndRef} />
                            </div>
                        )}

                        {/* Sticky Bottom Form (Only when chat is active) */}
                        {(activeConversation || streamingAnswer || isLoading) && (
                            <div className="fixed bottom-0 left-0 right-0 z-10 lg:left-64 p-4 bg-gradient-to-t from-white dark:from-[#0B0D0E] via-white dark:via-[#0B0D0E] to-transparent">
                                <div className="max-w-3xl mx-auto">
                                    <form onSubmit={handleQuerySubmit} className="bg-slate-50 dark:bg-[#16181A] border border-slate-200 dark:border-[#2B2F32] rounded-xl p-1.5 shadow-2xl flex items-center gap-2 focus-within:border-orange-500/50 transition">
                                        <textarea
                                            ref={followUpTextareaRef}
                                            value={query}
                                            onChange={(e) => setQuery(e.target.value)}
                                            placeholder="Ask follow-up query..."
                                            rows={1}
                                            className="flex-1 bg-transparent border-0 outline-none text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 px-3 py-2 text-sm resize-none min-h-[36px] max-h-[160px]"
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter" && !e.shiftKey) {
                                                    e.preventDefault();
                                                    handleQuerySubmit(e);
                                                }
                                            }}
                                        />
                                        {isLoading ? (
                                            <button
                                                type="button"
                                                onClick={handleStopRequest}
                                                className="p-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg transition duration-150 flex items-center justify-center flex-shrink-0 cursor-pointer"
                                                title="Stop generating"
                                            >
                                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>
                                            </button>
                                        ) : (
                                            <button
                                                type="submit"
                                                disabled={!query.trim()}
                                                className="p-2 bg-orange-600 dark:bg-orange-500 text-white dark:text-slate-950 font-bold rounded-lg hover:bg-orange-500 dark:hover:bg-orange-400 disabled:opacity-50 disabled:hover:bg-orange-500 transition duration-150 flex items-center justify-center flex-shrink-0 cursor-pointer"
                                            >
                                                <Send className="w-4 h-4" />
                                            </button>
                                        )}
                                    </form>
                                </div>
                            </div>
                        )}

                    </div>
                </main>
            </div>
        </div>
    );
}