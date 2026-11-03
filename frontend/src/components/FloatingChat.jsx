import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import EmojiPicker from "emoji-picker-react";
import {
    FaArrowLeft,
    FaBookmark,
    FaCheck,
    FaCheckDouble,
    FaCommentDots,
    FaCopy,
    FaDownload,
    FaEllipsisV,
    FaAt,
    FaFile,
    FaImage,
    FaMicrophone,
    FaPaperclip,
    FaPaperPlane,
    FaPlus,
    FaReply,
    FaSearch,
    FaShare,
    FaSmile,
    FaStop,
    FaTimes,
    FaTrash,
    FaAddressCard,
    FaUserCircle,
    FaUserPlus
} from "react-icons/fa";
import API from "../services/api";
import { getUser } from "../hooks/useAuth";

const formatTime = (date) => new Date(date).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
});

const messagePreview = (message) => {
    if (!message) return "Start the conversation";
    if (message.type === "gif") return "GIF";
    if (message.type === "sticker") return "Sticker";
    if (message.type === "image") return "Image";
    if (message.type === "file") return message.content || "File";
    if (message.type === "contact") return "Contact card";
    return message.content;
};

const parseContactCard = (content) => {
    try {
        return JSON.parse(content);
    } catch {
        return null;
    }
};

const readFavoriteChatKeys = (userId) => {
    if (userId == null) return [];
    try {
        const stored = JSON.parse(localStorage.getItem(`smartcampus:chat-favorites:${userId}`) || "[]");
        return Array.isArray(stored) ? stored.filter((key) => typeof key === "string") : [];
    } catch {
        return [];
    }
};

const readSavedChatMedia = (userId) => {
    if (userId == null) return [];
    try {
        const stored = JSON.parse(localStorage.getItem(`smartcampus:chat-media:${userId}`) || "[]");
        return Array.isArray(stored)
            ? stored.filter((item) => item && ["gif", "sticker"].includes(item.type) &&
                typeof item.url === "string" && typeof item.previewUrl === "string")
            : [];
    } catch {
        return [];
    }
};

const FloatingChat = ({ initialOpen = false, initialShare = null }) => {
    const [user, setUser] = useState(getUser);
    const isStudent = user?.role === "student";
    const [open, setOpen] = useState(initialOpen);
    const [chatLoaded, setChatLoaded] = useState(false);
    const [profile, setProfile] = useState(null);
    const [courses, setCourses] = useState([]);
    const [coursemates, setCoursemates] = useState([]);
    const [coursematesLoading, setCoursematesLoading] = useState(false);
    const [privateChats, setPrivateChats] = useState([]);
    const [chatFolder, setChatFolder] = useState("all");
    const [favoriteChatKeys, setFavoriteChatKeys] = useState(() => readFavoriteChatKeys(getUser()?.id));
    const [favoriteSelection, setFavoriteSelection] = useState([]);
    const [favoriteStorageError, setFavoriteStorageError] = useState("");
    const [view, setView] = useState(() => initialShare ? "share-announcement" : "list");
    const [activeChat, setActiveChat] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessagesDividerId, setNewMessagesDividerId] = useState(null);
    const [search, setSearch] = useState("");
    const [query, setQuery] = useState("");
    const [usernameSearchProfile, setUsernameSearchProfile] = useState(null);
    const [usernameSearchLoading, setUsernameSearchLoading] = useState(false);
    const [usernameSearchError, setUsernameSearchError] = useState("");
    const [username, setUsername] = useState("");
    const [avatarUrl, setAvatarUrl] = useState("");
    const [about, setAbout] = useState("");
    const [profileError, setProfileError] = useState("");
    const [profileSaving, setProfileSaving] = useState(false);
    const [profileEditing, setProfileEditing] = useState(false);
    const [profilePhone, setProfilePhone] = useState("");
    const [profileEmail, setProfileEmail] = useState("");
    const [profileMatNumber, setProfileMatNumber] = useState("");
    const [contactVisibility, setContactVisibility] = useState({
        phoneVisibility: "private_contacts",
        emailVisibility: "private_contacts",
        matNumberVisibility: "private_contacts"
    });
    const [profileSettingsLoading, setProfileSettingsLoading] = useState(false);
    const [visibilitySavingField, setVisibilitySavingField] = useState("");
    const [privateContactApproval, setPrivateContactApproval] = useState({
        profileId: null,
        approved: false
    });
    const [privateContactSaving, setPrivateContactSaving] = useState(false);
    const [draft, setDraft] = useState("");
    const [sending, setSending] = useState(false);
    const [error, setError] = useState("");
    const [showEmoji, setShowEmoji] = useState(false);
    const [showAttachments, setShowAttachments] = useState(false);
    const [mediaType, setMediaType] = useState("gif");
    const [mediaTab, setMediaTab] = useState("emoji");
    const [savedMedia, setSavedMedia] = useState(() => readSavedChatMedia(getUser()?.id));
    const [replyTo, setReplyTo] = useState(null);
    const [contextMessage, setContextMessage] = useState(null);
    const [mentionChoices, setMentionChoices] = useState([]);
    const [savedMessages, setSavedMessages] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [onlineProfiles, setOnlineProfiles] = useState(() => new Set());
    const [typingUsers, setTypingUsers] = useState([]);
    const [mediaQuery, setMediaQuery] = useState("");
    const [mediaResults, setMediaResults] = useState([]);
    const [mediaSearching, setMediaSearching] = useState(false);
    const [recording, setRecording] = useState(false);
    const [recordingSeconds, setRecordingSeconds] = useState(0);
    const [mediaSources, setMediaSources] = useState({});
    const [realtimeMode, setRealtimeMode] = useState("server");
    const [shareAnnouncement, setShareAnnouncement] = useState(initialShare);
    const [shareError, setShareError] = useState("");
    const scrollRef = useRef(null);
    const draftRef = useRef(null);
    const currentChatRef = useRef(activeChat);
    const newMessagesDividerRef = useRef(null);
    const privateContactApprovalLoaded = privateContactApproval.profileId === activeChat?.id;
    const privateContactApproved = privateContactApprovalLoaded && privateContactApproval.approved;
    const mediaRecorderRef = useRef(null);
    const voiceChunksRef = useRef([]);
    const imageInputRef = useRef(null);
    const fileInputRef = useRef(null);
    const typingTimersRef = useRef({ expire: null });
    const lastTypingSentRef = useRef(0);
    const voiceSourcesRef = useRef({});
    const lastTouchRef = useRef({ messageId: null, at: 0 });
    const supabaseRealtimeActiveRef = useRef(false);
    const privateChatProfileId = activeChat?.type === "private" ? activeChat.id : null;
    const privateChatKey = activeChat?.type === "private" ? activeChat.key : null;

    useEffect(() => {
        if (!open) return undefined;
        const previousOverflow = document.body.style.overflow;
        const previousOverscroll = document.body.style.overscrollBehavior;
        document.body.style.overflow = "hidden";
        document.body.style.overscrollBehavior = "none";
        return () => {
            document.body.style.overflow = previousOverflow;
            document.body.style.overscrollBehavior = previousOverscroll;
        };
    }, [open]);

    useEffect(() => {
        const syncAccount = () => {
            setUser(getUser());
            setOpen(false);
            setChatLoaded(false);
            setProfile(null);
            setProfileEditing(false);
            setCourses([]);
            setCoursemates([]);
            setPrivateChats([]);
            setChatFolder("all");
            setFavoriteChatKeys(readFavoriteChatKeys(getUser()?.id));
            setSavedMedia(readSavedChatMedia(getUser()?.id));
            setFavoriteStorageError("");
            setActiveChat(null);
            setMessages([]);
            newMessagesDividerRef.current = null;
            setNewMessagesDividerId(null);
            setSavedMessages([]);
            setUsername("");
            setAvatarUrl("");
            setAbout("");
            setOnlineProfiles(new Set());
            setTypingUsers([]);
            setShareAnnouncement(null);
            setShareError("");
        };
        window.addEventListener("smartcampus:account-changed", syncAccount);
        window.addEventListener("storage", syncAccount);
        return () => {
            window.removeEventListener("smartcampus:account-changed", syncAccount);
            window.removeEventListener("storage", syncAccount);
        };
    }, []);

    useEffect(() => {
        currentChatRef.current = activeChat;
    }, [activeChat]);

    const refresh = useCallback(async () => {
        const response = await API.get("/chat/me");
        setProfile((current) => current?.id === response.data.profile?.id &&
            current?.username === response.data.profile?.username &&
            current?.avatarUrl === response.data.profile?.avatarUrl
            ? current
            : response.data.profile);
        setChatLoaded(true);
        setCourses(response.data.courses || []);
        setPrivateChats(response.data.privateChats || []);
        setUnreadCount(
            (response.data.courses || []).reduce((total, course) => total + (course.unreadCount || 0), 0) +
            (response.data.privateChats || []).reduce((total, chat) => total + (chat.unreadCount || 0), 0)
        );
        if (!response.data.profile) setUsername("");
    }, []);

    useEffect(() => {
        if (!open || !isStudent) return undefined;
        let mounted = true;
        API.get("/chat/me")
            .then((response) => {
                if (!mounted) return;
                setProfile((current) => current?.id === response.data.profile?.id &&
                    current?.username === response.data.profile?.username &&
                    current?.avatarUrl === response.data.profile?.avatarUrl
                    ? current
                    : response.data.profile);
                setCourses(response.data.courses || []);
                setPrivateChats(response.data.privateChats || []);
                setUnreadCount(
                    (response.data.courses || []).reduce((total, course) => total + (course.unreadCount || 0), 0) +
                    (response.data.privateChats || []).reduce((total, chat) => total + (chat.unreadCount || 0), 0)
                );
                if (!response.data.profile) setUsername("");
            })
            .catch((requestError) => {
                if (mounted) setError(requestError.response?.data?.message || "Unable to load chats.");
            })
            .finally(() => {
                if (mounted) setChatLoaded(true);
            });
        return () => { mounted = false; };
    }, [open, isStudent]);

    const loadMessages = useCallback(async (chat, quiet = false) => {
        if (!chat) return;
        try {
            const url = chat.type === "course"
                ? `/chat/courses/${chat.id}/messages`
                : `/chat/private/${chat.id}/messages`;
            const response = await API.get(url);
            if (currentChatRef.current?.key !== chat.key) return;
            setMessages(response.data || []);
            if (!newMessagesDividerRef.current) {
                const firstUnread = response.data.find((message) =>
                    message.senderProfileId !== profile?.id &&
                    (message.isNew === true || (chat.type === "private" && message.isRead === false))
                );
                if (firstUnread) {
                    newMessagesDividerRef.current = firstUnread.id;
                    setNewMessagesDividerId(firstUnread.id);
                }
            }
            if (!quiet) setError("");
        } catch (requestError) {
            if (!quiet) setError(requestError.response?.data?.message || "Unable to load this conversation.");
        }
    }, [profile?.id]);

    useEffect(() => {
        if (!open || !activeChat || !profile) return undefined;
        const timer = window.setTimeout(() => {
            loadMessages(activeChat).then(() => refresh()).catch((requestError) => {
                setError(requestError.response?.data?.message || "Unable to load this conversation.");
            });
        }, 0);
        return () => window.clearTimeout(timer);
    }, [open, activeChat, profile, loadMessages, refresh]);

    useEffect(() => {
        if (!open || !profile || activeChat?.type !== "private") {
            return undefined;
        }
        let cancelled = false;
        API.get(`/chat/profile/private-contact/${encodeURIComponent(activeChat.id)}`, { skipOfflineCache: true })
            .then((response) => {
                if (!cancelled) {
                    setPrivateContactApproval({
                        profileId: activeChat.id,
                        approved: response.data.approved === true
                    });
                }
            })
            .catch((requestError) => {
                if (!cancelled) {
                    setPrivateContactApproval({ profileId: activeChat.id, approved: false });
                    setError(requestError.response?.data?.message || "Unable to load contact privacy approval.");
                }
            });
        return () => {
            cancelled = true;
        };
    }, [open, profile, activeChat?.id, activeChat?.type]);

    useEffect(() => {
        if (!privateChatProfileId || !privateChatKey) return undefined;
        let mounted = true;
        API.get(`/chat/profiles/${privateChatProfileId}`, { skipOfflineCache: true })
            .then((response) => {
                if (!mounted) return;
                setActiveChat((current) => current?.key === privateChatKey
                    ? { ...current, participant: response.data.profile }
                    : current);
            })
            .catch((requestError) => {
                if (mounted) setError(requestError.response?.data?.message || "Unable to load this chat profile.");
            });
        return () => { mounted = false; };
    }, [privateChatKey, privateChatProfileId]);

    useEffect(() => {
        if (!profile) return undefined;
        const controller = new AbortController();
        const pause = (delay) => new Promise((resolve) => window.setTimeout(resolve, delay));
        const consumeEvents = async () => {
            let retryDelay = 1000;
            while (!controller.signal.aborted) {
                try {
                    const response = await fetch(`${API.defaults.baseURL}/chat/events`, {
                        headers: { Authorization: `Bearer ${localStorage.getItem("token") || ""}` },
                        signal: controller.signal
                    });
                    if (!response.ok || !response.body) {
                        if (response.status === 401) throw new Error("Your chat session expired. Please sign in again.");
                        throw new Error("Chat connection is unavailable.");
                    }
                    retryDelay = 1000;
                    const reader = response.body.getReader();
                    const decoder = new TextDecoder();
                    let buffer = "";
                    while (!controller.signal.aborted) {
                        const { value, done } = await reader.read();
                        if (done) break;
                        buffer += decoder.decode(value, { stream: true });
                        const blocks = buffer.split(/\r?\n\r?\n/);
                        buffer = blocks.pop() || "";
                        for (const block of blocks) {
                            const event = block.match(/^event:\s*(.+)$/m)?.[1];
                            const payload = block.match(/^data:\s*(.+)$/m)?.[1];
                            if (!event || !payload) continue;
                            const data = JSON.parse(payload);
                            if (event === "ready") {
                                setOnlineProfiles(new Set(data.onlineProfileIds || []));
                            } else if (event === "presence") {
                                setOnlineProfiles((current) => {
                                    const next = new Set(current);
                                    if (data.online) next.add(data.profileId);
                                    else next.delete(data.profileId);
                                    return next;
                                });
                            } else if (event === "message") {
                                if (supabaseRealtimeActiveRef.current) continue;
                                const chat = currentChatRef.current;
                                const belongsToActive = chat?.type === "course"
                                    ? Number(data.courseId) === Number(chat.id) && !data.receiverProfileId
                                    : chat?.type === "private" && data.courseId == null &&
                                        (data.senderProfileId === chat.id || data.receiverProfileId === chat.id);
                                if (belongsToActive) {
                                    loadMessages(chat, true).then(() => refresh()).catch((requestError) => {
                                        setError(requestError.response?.data?.message || "Unable to update chat status.");
                                    });
                                }
                                else refresh().catch((requestError) => {
                                    setError(requestError.response?.data?.message || "Unable to update unread messages.");
                                });
                            } else if (event === "typing") {
                                const chat = currentChatRef.current;
                                const belongsToActive = chat?.type === "course"
                                    ? Number(data.courseId) === Number(chat.id)
                                    : chat?.type === "private" && data.conversationProfileId === chat.id;
                                if (!belongsToActive) continue;
                                setTypingUsers((current) => [
                                    ...current.filter((item) => item.profileId !== data.profileId),
                                    ...(data.isTyping ? [data] : [])
                                ]);
                                if (data.isTyping) {
                                    window.setTimeout(() => setTypingUsers((current) =>
                                        current.filter((item) => item.profileId !== data.profileId)
                                    ), 2200);
                                }
                            } else if (event === "read") {
                                setMessages((current) => current.map((message) =>
                                    message.senderProfileId === profile.id &&
                                    message.receiverProfileId === data.profileId
                                        ? { ...message, isRead: true }
                                        : message
                                ));
                            } else if (event === "delivered") {
                                const deliveredIds = new Set(data.messageIds || []);
                                setMessages((current) => current.map((message) =>
                                    deliveredIds.has(message.id)
                                        ? { ...message, deliveredAt: message.deliveredAt || new Date().toISOString() }
                                        : message
                                ));
                            } else if (event === "reaction") {
                                const chat = currentChatRef.current;
                                if (chat) loadMessages(chat, true).catch((requestError) => {
                                    setError(requestError.response?.data?.message || "Unable to update message reactions.");
                                });
                            } else if (event === "mention") {
                                setError("You were mentioned in a course chat.");
                                refresh().catch((requestError) => {
                                    setError(requestError.response?.data?.message || "Unable to refresh your chats.");
                                });
                            }
                        }
                    }
                } catch (requestError) {
                    if (controller.signal.aborted) break;
                    setError(requestError.message || "Chat connection was interrupted.");
                    await pause(retryDelay);
                    retryDelay = Math.min(retryDelay * 2, 10000);
                }
            }
        };
        consumeEvents();
        return () => {
            controller.abort();
        };
    }, [profile, loadMessages, refresh]);

    useEffect(() => {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        if (!profile || !supabaseUrl || !anonKey) {
            supabaseRealtimeActiveRef.current = false;
            const fallbackTimer = window.setTimeout(() => setRealtimeMode("server"), 0);
            return () => window.clearTimeout(fallbackTimer);
        }
        let cancelled = false;
        let client;
        let channel;
        let tokenRefresh;
        const startRealtime = async () => {
            try {
                const tokenResponse = await API.get("/chat/realtime-token", { skipOfflineCache: true });
                if (cancelled) return;
                const { createClient } = await import("@supabase/supabase-js");
                if (cancelled) return;
                client = createClient(supabaseUrl, anonKey, {
                    auth: {
                        persistSession: false,
                        autoRefreshToken: false,
                        detectSessionInUrl: false
                    }
                });
                await client.realtime.setAuth(tokenResponse.data.token);
                if (cancelled) return;
                channel = client.channel(`smartcampus-chat-${profile.id}`)
                    .on("postgres_changes", {
                        event: "INSERT",
                        schema: "public",
                        table: "ChatMessages"
                    }, (payload) => {
                        const message = payload.new;
                        const chat = currentChatRef.current;
                        const belongsToActive = chat?.type === "course"
                            ? Number(message.courseId) === Number(chat.id) && !message.receiverProfileId
                            : chat?.type === "private" && message.courseId == null &&
                                (message.senderProfileId === chat.id || message.receiverProfileId === chat.id);
                        if (belongsToActive) {
                            loadMessages(chat, true).then(() => refresh()).catch((requestError) => {
                                setError(requestError.response?.data?.message || "Unable to update chat status.");
                            });
                        } else {
                            refresh().catch((requestError) => {
                                setError(requestError.response?.data?.message || "Unable to update unread messages.");
                            });
                        }
                    })
                    .on("postgres_changes", {
                        event: "UPDATE",
                        schema: "public",
                        table: "ChatMessages"
                    }, (payload) => {
                        setMessages((current) => current.map((message) =>
                            message.id === payload.new.id
                                ? {
                                    ...message,
                                    isRead: Boolean(payload.new.isRead),
                                    deliveredAt: payload.new.deliveredAt || message.deliveredAt
                                }
                                : message
                        ));
                    })
                    .subscribe((status) => {
                        const connected = status === "SUBSCRIBED";
                        supabaseRealtimeActiveRef.current = connected;
                        setRealtimeMode(connected ? "supabase" : "server");
                    });
                tokenRefresh = window.setInterval(async () => {
                    try {
                        const response = await API.get("/chat/realtime-token", { skipOfflineCache: true });
                        await client.realtime.setAuth(response.data.token);
                    } catch (requestError) {
                        supabaseRealtimeActiveRef.current = false;
                        setRealtimeMode("server");
                        setError(requestError.response?.data?.message || "Unable to refresh the live chat connection.");
                    }
                }, 8 * 60 * 1000);
            } catch (requestError) {
                supabaseRealtimeActiveRef.current = false;
                setRealtimeMode("server");
                console.warn("Supabase Realtime is unavailable; using the authenticated server stream.", requestError.message);
            }
        };
        startRealtime();
        return () => {
            cancelled = true;
            supabaseRealtimeActiveRef.current = false;
            window.clearInterval(tokenRefresh);
            if (channel && client) client.removeChannel(channel);
        };
    }, [profile, loadMessages, refresh]);

    useEffect(() => {
        if (!open || !profile) return undefined;
        let mounted = true;
        API.get("/chat/saved")
            .then((response) => {
                if (mounted) setSavedMessages(response.data || []);
            })
            .catch((requestError) => {
                if (mounted) setError(requestError.response?.data?.message || "Unable to load saved messages.");
            });
        return () => { mounted = false; };
    }, [open, profile]);

    useEffect(() => {
        let cancelled = false;
        const loadMessageMedia = async () => {
            const mediaMessages = messages.filter((message) =>
                ["voice", "image", "file"].includes(message.type) && !voiceSourcesRef.current[message.id]
            );
            await Promise.all(mediaMessages.map(async (message) => {
                try {
                    const response = await API.get(`/chat/messages/${message.id}/media`, {
                        responseType: "blob"
                    });
                    const objectUrl = URL.createObjectURL(response.data);
                    if (cancelled) {
                        URL.revokeObjectURL(objectUrl);
                        return;
                    }
                    voiceSourcesRef.current[message.id] = objectUrl;
                    setMediaSources((current) => ({ ...current, [message.id]: objectUrl }));
                } catch (requestError) {
                    if (!cancelled) setError(requestError.response?.data?.message || "Unable to load a message attachment.");
                }
            }));
        };
        loadMessageMedia();
        return () => { cancelled = true; };
    }, [messages]);

    useEffect(() => {
        if (!recording) return undefined;
        const timer = window.setInterval(() => setRecordingSeconds((seconds) => seconds + 1), 1000);
        return () => window.clearInterval(timer);
    }, [recording]);

    useEffect(() => () => {
        Object.values(voiceSourcesRef.current).forEach((url) => URL.revokeObjectURL(url));
        window.clearTimeout(typingTimersRef.current.expire);
        const recorder = mediaRecorderRef.current;
        if (recorder && recorder.state !== "inactive") {
            recorder.onstop = null;
            recorder.stop();
            recorder.stream.getTracks().forEach((track) => track.stop());
        }
    }, []);

    useEffect(() => {
        if (!open || !profile || activeChat) return undefined;
        const interval = window.setInterval(() => {
            refresh().catch((requestError) => {
                setError(requestError.response?.data?.message || "Unable to refresh chat list.");
            });
        }, 12000);
        return () => window.clearInterval(interval);
    }, [open, profile, activeChat, refresh]);

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [messages]);

    useEffect(() => {
        if (!draft.endsWith("@") && !/@[a-z0-9_]{1,19}$/i.test(draft)) {
            const clearTimer = window.setTimeout(() => setMentionChoices([]), 0);
            return () => window.clearTimeout(clearTimer);
        }
        if (activeChat?.type !== "course") return undefined;
        const match = draft.match(/@([a-z0-9_]{1,19})$/i);
        if (!match) return undefined;
        const timer = window.setTimeout(() => {
            API.get("/chat/profiles/search", {
                params: { username: match[1], courseId: activeChat.id },
                skipOfflineCache: true
            }).then((response) => setMentionChoices(response.data.profiles || []))
                .catch(() => setMentionChoices([]));
        }, 180);
        return () => window.clearTimeout(timer);
    }, [draft, activeChat]);

    useEffect(() => {
        const usernameQuery = query.trim().replace(/^@/, "").toLowerCase();
        if (!open || view !== "search" || !/^[a-z0-9_]{3,20}$/.test(usernameQuery)) return undefined;
        let cancelled = false;
        const timer = window.setTimeout(() => {
            setUsernameSearchLoading(true);
            API.get("/chat/profiles/search", {
                params: { username: usernameQuery },
                skipOfflineCache: true
            }).then((response) => {
                if (!cancelled) setUsernameSearchProfile(response.data.profile || null);
            }).catch((requestError) => {
                if (!cancelled) {
                    setUsernameSearchError(requestError.response?.data?.message || "Unable to search SmartCampus usernames.");
                }
            }).finally(() => {
                if (!cancelled) setUsernameSearchLoading(false);
            });
        }, 250);
        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [open, query, view]);

    const openConversation = (chat) => {
        setActiveChat(chat);
        setMessages([]);
        newMessagesDividerRef.current = null;
        setNewMessagesDividerId(null);
        setDraft("");
        setReplyTo(null);
        setContextMessage(null);
        setShowEmoji(false);
        setShowAttachments(false);
        setTypingUsers([]);
        window.clearTimeout(typingTimersRef.current.expire);
        setError("");
        setView(chat.type);
    };

    const shareAnnouncementToChat = async (target) => {
        if (!shareAnnouncement || sending) return;
        const announcementUrl = new URL(
            `/announcements#announcement-${shareAnnouncement.id}`,
            window.location.origin
        ).toString();
        const body = shareAnnouncement.body.length > 3000
            ? `${shareAnnouncement.body.slice(0, 3000)}…`
            : shareAnnouncement.body;
        const content = `${shareAnnouncement.title}\n${body}\n\n${shareAnnouncement.courseTitle} announcement\n${announcementUrl}`;
        setSending(true);
        setShareError("");
        try {
            const response = await API.post("/chat/messages", {
                courseId: target.type === "course" ? Number(target.id) : null,
                receiverProfileId: target.type === "private" ? target.id : null,
                content,
                type: "text"
            });
            setShareAnnouncement(null);
            openConversation(target);
            setMessages([response.data]);
            refresh().catch((requestError) => {
                setError(requestError.response?.data?.message || "Announcement shared, but the chat list could not refresh.");
            });
        } catch (requestError) {
            setShareError(requestError.response?.data?.message || "Unable to share this announcement.");
        } finally {
            setSending(false);
        }
    };

    const saveUsername = async (event) => {
        event.preventDefault();
        setProfileError("");
        setProfileSaving(true);
        try {
            const response = await API.put("/chat/profile", {
                username,
                avatarUrl: avatarUrl || null,
                about
            });
            setProfile(response.data.profile);
            setProfileEditing(false);
            await refresh();
        } catch (requestError) {
            setProfileError(requestError.response?.data?.message || "Unable to save your chat profile.");
        } finally {
            setProfileSaving(false);
        }
    };

    const selectProfilePicture = async (event) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
            setProfileError("Choose a JPG, PNG, or WebP picture.");
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            setProfileError("Choose a picture smaller than 10 MB.");
            return;
        }
        setProfileError("");
        try {
            const imageUrl = URL.createObjectURL(file);
            try {
                const image = new Image();
                image.src = imageUrl;
                await image.decode();
                const size = 256;
                const canvas = document.createElement("canvas");
                canvas.width = size;
                canvas.height = size;
                const context = canvas.getContext("2d");
                if (!context) throw new Error("Unable to process this picture.");
                const cropSize = Math.min(image.naturalWidth, image.naturalHeight);
                context.drawImage(
                    image,
                    (image.naturalWidth - cropSize) / 2,
                    (image.naturalHeight - cropSize) / 2,
                    cropSize,
                    cropSize,
                    0,
                    0,
                    size,
                    size
                );
                let picture = canvas.toDataURL("image/jpeg", 0.82);
                if (Math.ceil((picture.length - picture.indexOf(",") - 1) * 0.75) > 128 * 1024) {
                    picture = canvas.toDataURL("image/jpeg", 0.6);
                }
                if (Math.ceil((picture.length - picture.indexOf(",") - 1) * 0.75) > 128 * 1024) {
                    throw new Error("This picture could not be compressed enough. Choose another image.");
                }
                setAvatarUrl(picture);
            } finally {
                URL.revokeObjectURL(imageUrl);
            }
        } catch (requestError) {
            setProfileError(requestError.message || "Unable to read this picture.");
        }
    };

    const fetchCoursemates = async () => {
        setCoursematesLoading(true);
        try {
            const params = activeChat?.type === "course"
                ? { courseId: activeChat.id }
                : activeChat?.type === "private"
                    ? { withProfileId: activeChat.id }
                    : undefined;
            const response = await API.get("/chat/coursemates", { params, skipOfflineCache: true });
            setCoursemates(response.data.profiles || []);
            return response.data.profiles || [];
        } catch (requestError) {
            setError(requestError.response?.data?.message || "Unable to load your coursemates.");
            return [];
        } finally {
            setCoursematesLoading(false);
        }
    };

    const openCoursemates = async () => {
        setView("search");
        setQuery("");
        setUsernameSearchProfile(null);
        setUsernameSearchLoading(false);
        setUsernameSearchError("");
        setError("");
        await fetchCoursemates();
    };

    const openProfileSettings = async () => {
        setView("profile");
        setProfileEditing(false);
        setError("");
        setProfileSettingsLoading(true);
        try {
            const response = await API.get("/chat/profile/settings", { skipOfflineCache: true });
            setProfilePhone(response.data.phoneNumber || "");
            setProfileEmail(response.data.email || "");
            setProfileMatNumber(response.data.matNumber || "");
            setContactVisibility(response.data.visibility || {
                phoneVisibility: "private_contacts",
                emailVisibility: "private_contacts",
                matNumberVisibility: "private_contacts"
            });
        } catch (requestError) {
            setError(requestError.response?.data?.message || "Unable to load your profile settings.");
        } finally {
            setProfileSettingsLoading(false);
        }
    };

    const updateContactVisibility = async (field, visibility) => {
        setVisibilitySavingField(field);
        setError("");
        try {
            const response = await API.put("/chat/profile/visibility", { [field]: visibility });
            setContactVisibility((current) => ({ ...current, ...response.data.visibility }));
        } catch (requestError) {
            setError(requestError.response?.data?.message || "Unable to update this privacy setting.");
        } finally {
            setVisibilitySavingField("");
        }
    };

    const updatePrivateContactApproval = async () => {
        if (!activeChat || activeChat.type !== "private" || !privateContactApprovalLoaded || privateContactSaving) return;
        setPrivateContactSaving(true);
        setError("");
        try {
            const response = await API.put(
                `/chat/profile/private-contact/${encodeURIComponent(activeChat.id)}`,
                { approved: !privateContactApproved }
            );
            setPrivateContactApproval({
                profileId: activeChat.id,
                approved: response.data.approved === true
            });
        } catch (requestError) {
            setError(requestError.response?.data?.message || "Unable to update contact privacy approval.");
        } finally {
            setPrivateContactSaving(false);
        }
    };

    const sendAttachment = async (file, type) => {
        if (!file || !activeChat || sending) return;
        const formData = new FormData();
        if (activeChat.type === "course") formData.append("courseId", String(activeChat.id));
        else formData.append("receiverProfileId", activeChat.id);
        formData.append("type", type);
        formData.append("content", file.name);
        if (replyTo) formData.append("replyTo", replyTo.id);
        formData.append("attachment", file);
        setSending(true);
        setError("");
        setShowAttachments(false);
        try {
            const response = await API.post("/chat/messages", formData, {
                headers: { "Content-Type": "multipart/form-data" }
            });
            setMessages((current) => [...current, response.data]);
            setReplyTo(null);
            refresh().catch((requestError) => {
                setError(requestError.response?.data?.message || "Attachment sent, but the chat list could not refresh.");
            });
        } catch (requestError) {
            setError(requestError.response?.data?.message || "Unable to send this attachment.");
        } finally {
            setSending(false);
        }
    };

    const sendContact = async (contact) => {
        if (!activeChat || sending) return;
        setSending(true);
        setError("");
        setShowAttachments(false);
        try {
            const response = await API.post("/chat/messages", {
                courseId: activeChat.type === "course" ? Number(activeChat.id) : null,
                receiverProfileId: activeChat.type === "private" ? activeChat.id : null,
                content: JSON.stringify({ profileId: contact.id }),
                type: "contact",
                replyTo: replyTo?.id || null
            });
            setMessages((current) => [...current, response.data]);
            setReplyTo(null);
            refresh().catch((requestError) => {
                setError(requestError.response?.data?.message || "Contact sent, but the chat list could not refresh.");
            });
        } catch (requestError) {
            setError(requestError.response?.data?.message || "Unable to send this contact.");
        } finally {
            setSending(false);
        }
    };

    const sendMessage = async (event, media = null) => {
        event?.preventDefault();
        if ((!draft.trim() && !media) || !activeChat || sending) return;
        const content = media?.content || draft.trim();
        const type = media?.type || "text";
        setSending(true);
        setError("");
        try {
            const response = await API.post("/chat/messages", {
                courseId: activeChat.type === "course" ? Number(activeChat.id) : null,
                receiverProfileId: activeChat.type === "private" ? activeChat.id : null,
                content,
                type,
                replyTo: replyTo?.id || null
            });
            setMessages((current) => [...current.filter((item) => item.id !== response.data.id), response.data]);
            setDraft("");
            setReplyTo(null);
            setShowEmoji(false);
            setMediaResults([]);
            setMentionChoices([]);
            refresh().catch((requestError) => {
                setError(requestError.response?.data?.message || "Message sent, but the chat list could not refresh.");
            });
        } catch (requestError) {
            setError(requestError.response?.data?.message || "Unable to send message.");
        } finally {
            setSending(false);
        }
    };

    const chooseMention = (member) => {
        setDraft((current) => current.replace(/@[a-z0-9_]{1,19}$/i, `@${member.username} `));
        setMentionChoices([]);
        draftRef.current?.focus();
    };

    const copyMessage = async (message) => {
        try {
            await navigator.clipboard.writeText(message.content);
        } catch {
            setError("Could not copy this message on this device.");
        }
        setContextMessage(null);
    };

    const toggleSaveMessage = async (message) => {
        const saved = savedMessages.some((item) => item.id === message.id);
        try {
            if (saved) {
                await API.delete(`/chat/messages/${message.id}/save`);
                setSavedMessages((current) => current.filter((item) => item.id !== message.id));
            } else {
                await API.post(`/chat/messages/${message.id}/save`);
                setSavedMessages((current) => [...current, message]);
            }
            setContextMessage(null);
        } catch (requestError) {
            setError(requestError.response?.data?.message || "Unable to update saved messages.");
        }
    };

    const deleteForMe = async (message) => {
        try {
            await API.delete(`/chat/messages/${message.id}/hide`);
            setMessages((current) => current.filter((item) => item.id !== message.id));
            setSavedMessages((current) => current.filter((item) => item.id !== message.id));
            setContextMessage(null);
        } catch (requestError) {
            setError(requestError.response?.data?.message || "Unable to hide this message.");
        }
    };

    const toggleMediaSaved = (item, type = mediaType) => {
        const key = `${type}:${item.id}`;
        const exists = savedMedia.some((saved) => saved.key === key);
        const next = exists
            ? savedMedia.filter((saved) => saved.key !== key)
            : [...savedMedia, { key, id: item.id, type, url: item.url, previewUrl: item.previewUrl }];
        try {
            localStorage.setItem(`smartcampus:chat-media:${user.id}`, JSON.stringify(next));
            setSavedMedia(next);
        } catch {
            setError("Unable to save this GIF or sticker on this device.");
        }
    };

    const toggleReaction = async (message, emoji) => {
        try {
            const response = await API.post(`/chat/messages/${message.id}/reactions`, { emoji });
            setMessages((current) => current.map((item) => item.id === message.id
                ? { ...item, reactions: response.data.reactions }
                : item));
            setContextMessage(null);
        } catch (requestError) {
            setError(requestError.response?.data?.message || "Unable to update the message reaction.");
        }
    };

    const downloadMessageMedia = async (message) => {
        try {
            const response = await API.get(`/chat/messages/${message.id}/media`, { responseType: "blob" });
            const objectUrl = URL.createObjectURL(response.data);
            const anchor = document.createElement("a");
            anchor.href = objectUrl;
            anchor.download = message.content || (message.type === "image" ? "chat-image" : "chat-file");
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
        } catch (requestError) {
            setError(requestError.response?.data?.message || "Unable to save this attachment to your device.");
        }
    };

    const searchMedia = async (event) => {
        event.preventDefault();
        if (mediaQuery.trim().length < 2) return;
        setMediaSearching(true);
        setError("");
        try {
            const response = await API.get("/chat/media/search", {
                params: { q: mediaQuery.trim(), type: mediaType },
                skipOfflineCache: true
            });
            setMediaResults(response.data.results || []);
        } catch (requestError) {
            setError(requestError.response?.data?.message || "Unable to search GIFs.");
        } finally {
            setMediaSearching(false);
        }
    };

    const uploadVoiceNote = async (blob) => {
        const formData = new FormData();
        if (activeChat.type === "course") formData.append("courseId", String(activeChat.id));
        else formData.append("receiverProfileId", activeChat.id);
        formData.append("type", "voice");
        formData.append("content", "Voice note");
        if (replyTo) formData.append("replyTo", replyTo.id);
        formData.append("voice", blob, `voice-note.${blob.type.includes("mp4") ? "mp4" : "webm"}`);
        setSending(true);
        setError("");
        try {
            const response = await API.post("/chat/messages", formData, {
                headers: { "Content-Type": "multipart/form-data" }
            });
            setMessages((current) => [...current, response.data]);
            setReplyTo(null);
            refresh().catch((requestError) => {
                setError(requestError.response?.data?.message || "Voice note sent, but the chat list could not refresh.");
            });
        } catch (requestError) {
            setError(requestError.response?.data?.message || "Unable to send voice note.");
        } finally {
            setSending(false);
        }
    };

    const toggleRecording = async () => {
        if (recording) {
            mediaRecorderRef.current?.stop();
            return;
        }
        try {
            if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
                throw new Error("Voice notes are not supported by this browser.");
            }
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mimeType = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm", "audio/ogg"]
                .find((type) => MediaRecorder.isTypeSupported(type));
            const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
            voiceChunksRef.current = [];
            recorder.ondataavailable = (event) => {
                if (event.data.size) voiceChunksRef.current.push(event.data);
            };
            recorder.onerror = () => setError("Voice recording failed. Check microphone permissions and try again.");
            recorder.onstop = () => {
                stream.getTracks().forEach((track) => track.stop());
                const blob = new Blob(voiceChunksRef.current, { type: recorder.mimeType || "audio/webm" });
                setRecording(false);
                setRecordingSeconds(0);
                if (blob.size) uploadVoiceNote(blob);
            };
            mediaRecorderRef.current = recorder;
            recorder.start();
            setRecording(true);
            setRecordingSeconds(0);
        } catch (requestError) {
            setError(requestError.message || "Unable to access the microphone.");
        }
    };

    const onDraftChange = (event) => {
        setDraft(event.target.value);
        if (!activeChat) return;
        const now = Date.now();
        if (now - lastTypingSentRef.current > 1000) {
            lastTypingSentRef.current = now;
            API.post("/chat/typing", activeChat.type === "course"
                ? { courseId: Number(activeChat.id), isTyping: true }
                : { receiverProfileId: activeChat.id, isTyping: true })
                .catch((requestError) => {
                    setError(requestError.response?.data?.message || "Unable to update typing status.");
                });
        }
        window.clearTimeout(typingTimersRef.current.expire);
        typingTimersRef.current.expire = window.setTimeout(() => {
            API.post("/chat/typing", activeChat.type === "course"
                ? { courseId: Number(activeChat.id), isTyping: false }
                : { receiverProfileId: activeChat.id, isTyping: false })
                .catch((requestError) => {
                    setError(requestError.response?.data?.message || "Unable to clear typing status.");
                });
        }, 1800);
    };

    const filteredCourses = useMemo(() => courses.filter((course) =>
        course.title.toLowerCase().includes(search.trim().toLowerCase())
    ), [courses, search]);
    const filteredPrivateChats = useMemo(() => privateChats.filter((chat) =>
        `${chat.profile.fullName} ${chat.profile.username}`.toLowerCase().includes(search.trim().toLowerCase())
    ), [privateChats, search]);
    const matchingCoursemates = useMemo(() => coursemates.filter((member) =>
        `${member.fullName} ${member.username}`.toLowerCase().includes(query.trim().toLowerCase())
    ), [coursemates, query]);
    const usernameSearchIsCoursemate = usernameSearchProfile
        && coursemates.some((member) => member.id === usernameSearchProfile.id);
    const visibleChats = useMemo(() => {
        const courseItems = chatFolder === "private" ? [] : filteredCourses.map((course) => ({
            key: `course-${course.id}`,
            type: "course",
            course,
            timestamp: course.latestMessage?.createdAt
                ? new Date(course.latestMessage.createdAt).getTime()
                : 0
        }));
        const privateItems = chatFolder === "courses" ? [] : filteredPrivateChats.map((chat) => ({
            key: `private-${chat.profile.id}`,
            type: "private",
            chat,
            timestamp: chat.latestMessage?.createdAt
                ? new Date(chat.latestMessage.createdAt).getTime()
                : 0
        }));
        const allItems = [...courseItems, ...privateItems];
        const folderItems = chatFolder === "favorites"
            ? allItems.filter((item) => favoriteChatKeys.includes(item.key))
            : allItems;
        return folderItems
            .sort((first, second) => second.timestamp - first.timestamp);
    }, [chatFolder, favoriteChatKeys, filteredCourses, filteredPrivateChats]);

    const availableFavoriteChats = useMemo(() => {
        const courseItems = courses.map((course) => ({
            key: `course-${course.id}`,
            title: course.title,
            subtitle: "Course group chat",
            avatarUrl: null,
            isCourse: true
        }));
        const privateItems = privateChats.map((chat) => ({
            key: `private-${chat.profile.id}`,
            title: chat.profile.fullName,
            subtitle: `@${chat.profile.username}`,
            avatarUrl: chat.profile.avatarUrl,
            isCourse: false
        }));
        return [...courseItems, ...privateItems];
    }, [courses, privateChats]);

    const toggleFavoriteSelection = (key) => {
        setFavoriteSelection((current) => current.includes(key)
            ? current.filter((favoriteKey) => favoriteKey !== key)
            : [...current, key]);
    };

    const saveFavoriteSelection = () => {
        const eligibleKeys = new Set(availableFavoriteChats.map((chat) => chat.key));
        const nextFavorites = [...new Set(favoriteSelection.filter((key) => eligibleKeys.has(key)))];
        setFavoriteChatKeys(nextFavorites);
        try {
            localStorage.setItem(`smartcampus:chat-favorites:${user.id}`, JSON.stringify(nextFavorites));
            setFavoriteStorageError("");
            setView("list");
        } catch {
            setFavoriteStorageError("Unable to save favorite chats on this device.");
        }
    };

    const closeChat = () => {
        setOpen(false);
        setShareAnnouncement(null);
        setShareError("");
        setView("list");
        setActiveChat(null);
        setMessages([]);
        newMessagesDividerRef.current = null;
        setNewMessagesDividerId(null);
        setTypingUsers([]);
        setContextMessage(null);
        refresh().catch((requestError) => {
            setError(requestError.response?.data?.message || "Unable to update your unread message count.");
        });
    };

    const messagesWithDividers = useMemo(() => {
        const entries = [];
        let previousDay = "";
        messages.forEach((message) => {
            const date = new Date(message.createdAt);
            const dayKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
            if (dayKey !== previousDay) {
                entries.push({
                    type: "day",
                    key: `day-${dayKey}`,
                    label: date.toLocaleDateString([], {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                        year: "numeric"
                    })
                });
                previousDay = dayKey;
            }
            if (message.id === newMessagesDividerId) {
                entries.push({ type: "unread", key: `unread-${message.id}` });
            }
            entries.push({ type: "message", key: message.id, message });
        });
        return entries;
    }, [messages, newMessagesDividerId]);

    if (!isStudent || !user) return null;

    return (
        <>
            <button
                type="button"
                className={`floating-chat-launcher${open ? " is-open" : ""}`}
                aria-label={open ? "Close chats" : `Open chats${unreadCount ? `, ${unreadCount} unread` : ""}`}
                aria-expanded={open}
                onClick={() => {
                    if (open) closeChat();
                    else setOpen(true);
                }}
            >
                {open ? <FaTimes aria-hidden="true" /> : <FaCommentDots aria-hidden="true" />}
                {unreadCount > 0 && <span className="floating-chat-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
            </button>

            {open && (
                <section className="floating-chat-window" aria-label="SmartCampus chats">
                    <button type="button" className="wa-page-close" aria-label="Exit chats" onClick={closeChat}>
                        <FaTimes aria-hidden="true" />
                    </button>
                    {!chatLoaded ? (
                        <div className="wa-empty" role="status">Loading your chats...</div>
                    ) : !profile ? (
                        <form className="chat-profile-modal" onSubmit={saveUsername}>
                            <span className="chat-profile-icon">{avatarUrl
                                ? <img src={avatarUrl} alt="Profile preview" />
                                : <FaUserCircle />}</span>
                            <p className="chat-kicker">SMARTCAMPUS CHAT</p>
                            <h2>Create your chat username</h2>
                            <div className="chat-profile-picture-options">
                                <button type="button" className="chat-primary-button" onClick={() => document.getElementById("chat-profile-picture")?.click()}>
                                    Add picture from photos or files
                                </button>
                                <button type="button" className="chat-default-picture-button" onClick={() => {
                                    setAvatarUrl("");
                                    setProfileError("");
                                }}>
                                    Use default app profile picture
                                </button>
                                <input
                                    id="chat-profile-picture"
                                    className="chat-hidden-file-input"
                                    type="file"
                                    accept="image/*"
                                    onChange={selectProfilePicture}
                                />
                            </div>
                            <label htmlFor="chat-username">Username</label>
                            <div className="chat-username-field">
                                <FaAt aria-hidden="true" />
                                <input
                                    id="chat-username"
                                    value={username}
                                    onChange={(event) => setUsername(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                                    minLength={3}
                                    maxLength={20}
                                    pattern="[a-z0-9_]{3,20}"
                                    placeholder="e.g. yunusa_bah"
                                    required
                                    autoFocus
                                />
                            </div>
                            <label htmlFor="chat-about">About <span>(optional)</span></label>
                            <textarea
                                id="chat-about"
                                value={about}
                                onChange={(event) => setAbout(event.target.value)}
                                maxLength={200}
                                placeholder="A little about you"
                            />
                            {profileError && <p className="chat-error" role="alert">{profileError}</p>}
                            <button className="chat-primary-button" disabled={profileSaving || username.length < 3}>
                                {profileSaving ? "Saving..." : "Continue to chats"}
                            </button>
                        </form>
                    ) : view === "favorite-select" ? (
                        <>
                            <header className="wa-header">
                                <button
                                    type="button"
                                    className="wa-icon-button"
                                    aria-label="Back to favorites"
                                    onClick={() => setView("list")}
                                ><FaArrowLeft /></button>
                                <div className="wa-heading-copy">
                                    <h2>Add favorites</h2>
                                    <small>Select chats, then add them to Favorites</small>
                                </div>
                            </header>
                            {favoriteStorageError && <p className="wa-inline-error" role="alert">{favoriteStorageError}</p>}
                            <div className="wa-favorite-select-list">
                                {availableFavoriteChats.map((chat) => (
                                    <label className="wa-favorite-select-row" key={chat.key}>
                                        <input
                                            type="checkbox"
                                            checked={favoriteSelection.includes(chat.key)}
                                            onChange={() => toggleFavoriteSelection(chat.key)}
                                        />
                                        <span className={`wa-course-avatar${chat.isCourse ? "" : " wa-private-avatar"}`}>
                                            {chat.avatarUrl
                                                ? <img src={chat.avatarUrl} alt="" />
                                                : chat.isCourse
                                                    ? chat.title.charAt(0).toUpperCase()
                                                    : <FaUserCircle aria-hidden="true" />}
                                        </span>
                                        <span className="wa-conversation-main">
                                            <strong>{chat.title}</strong>
                                            <small>{chat.subtitle}</small>
                                        </span>
                                    </label>
                                ))}
                                {!availableFavoriteChats.length && (
                                    <p className="wa-empty">Start or receive a chat before adding it to Favorites.</p>
                                )}
                            </div>
                            <footer className="wa-favorite-select-footer">
                                <button
                                    type="button"
                                    className="chat-primary-button"
                                    onClick={saveFavoriteSelection}
                                    disabled={!availableFavoriteChats.length}
                                >
                                    Add and done
                                </button>
                            </footer>
                        </>
                    ) : view === "share-announcement" ? (
                        <>
                            <header className="wa-header">
                                <button
                                    type="button"
                                    className="wa-icon-button"
                                    aria-label="Cancel announcement share"
                                    onClick={() => {
                                        setShareAnnouncement(null);
                                        setShareError("");
                                        setView("list");
                                    }}
                                ><FaArrowLeft /></button>
                                <div className="wa-heading-copy">
                                    <h2>Share announcement</h2>
                                    <small>Choose a student chat</small>
                                </div>
                            </header>
                            {shareAnnouncement && (
                                <div className="wa-share-announcement-preview">
                                    <strong>{shareAnnouncement.title}</strong>
                                    <span>{shareAnnouncement.courseTitle}</span>
                                </div>
                            )}
                            {shareError && <p className="wa-inline-error" role="alert">{shareError}</p>}
                            <label className="wa-search wa-share-search">
                                <FaSearch aria-hidden="true" />
                                <input
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    placeholder="Search chats"
                                    aria-label="Search chats to share announcement"
                                />
                            </label>
                            <div className="wa-favorite-select-list">
                                {courses
                                    .filter((course) => `${course.title}`.toLowerCase().includes(search.trim().toLowerCase()))
                                    .map((course) => (
                                        <button
                                            type="button"
                                            className="wa-favorite-select-row wa-share-target"
                                            key={`course-${course.id}`}
                                            disabled={sending}
                                            onClick={() => shareAnnouncementToChat({
                                                key: `course-${course.id}`,
                                                id: course.id,
                                                type: "course",
                                                title: course.title,
                                                studentCount: course.studentCount
                                            })}
                                        >
                                            <span className="wa-course-avatar">{course.title.charAt(0).toUpperCase()}</span>
                                            <span className="wa-conversation-main">
                                                <strong>{course.title}</strong>
                                                <small>Course group chat</small>
                                            </span>
                                            <FaShare aria-hidden="true" />
                                        </button>
                                    ))}
                                {privateChats
                                    .filter((chat) => `${chat.profile.fullName} ${chat.profile.username}`.toLowerCase().includes(search.trim().toLowerCase()))
                                    .map((chat) => (
                                        <button
                                            type="button"
                                            className="wa-favorite-select-row wa-share-target"
                                            key={`private-${chat.profile.id}`}
                                            disabled={sending}
                                            onClick={() => shareAnnouncementToChat({
                                                key: `private-${chat.profile.id}`,
                                                id: chat.profile.id,
                                                type: "private",
                                                title: chat.profile.fullName,
                                                participant: chat.profile
                                            })}
                                        >
                                            <span className="wa-course-avatar wa-private-avatar">{chat.profile.avatarUrl
                                                ? <img src={chat.profile.avatarUrl} alt="" />
                                                : <FaUserCircle aria-hidden="true" />}</span>
                                            <span className="wa-conversation-main">
                                                <strong>{chat.profile.fullName}</strong>
                                                <small>@{chat.profile.username}</small>
                                            </span>
                                            <FaShare aria-hidden="true" />
                                        </button>
                                    ))}
                                {!courses.length && !privateChats.length && (
                                    <p className="wa-empty">There are no student chats available to share with.</p>
                                )}
                            </div>
                            {sending && <p className="wa-empty" role="status">Sharing announcement…</p>}
                        </>
                    ) : view === "list" ? (
                        <>
                            <header className="wa-header">
                                <div className="wa-brand">
                                    <span className="wa-header-avatar">{profile.avatarUrl
                                        ? <img src={profile.avatarUrl} alt="" />
                                        : <FaUserCircle aria-hidden="true" />}</span>
                                    <div><h2>Chats</h2><small>@{profile.username}</small></div>
                                </div>
                                <nav className="wa-chat-tabs" role="tablist" aria-label="Chat folders">
                                    {[
                                        ["all", "All"],
                                        ["courses", "Courses"],
                                        ["private", "Private chats"],
                                        ["favorites", "Favorites"]
                                    ].map(([folder, label]) => (
                                        <button
                                            type="button"
                                            role="tab"
                                            key={folder}
                                            aria-selected={chatFolder === folder}
                                            className={chatFolder === folder ? "active" : ""}
                                            onClick={() => setChatFolder(folder)}
                                        >
                                            {label}
                                            {folder === "favorites" && favoriteChatKeys.length > 0 && (
                                                <span>{favoriteChatKeys.length}</span>
                                            )}
                                        </button>
                                    ))}
                                </nav>
                                <button
                                    type="button"
                                    className="wa-icon-button"
                                    aria-label="View saved messages"
                                    title="Saved messages"
                                    onClick={() => setView("saved")}
                                ><FaBookmark /></button>
                                <button
                                    type="button"
                                    className="wa-icon-button"
                                    aria-label="View your chat profile and information settings"
                                    title="View your chat profile and information settings"
                                    onClick={openProfileSettings}
                                ><FaEllipsisV /></button>
                            </header>
                            {favoriteStorageError && <p className="wa-inline-error" role="alert">{favoriteStorageError}</p>}
                            <div className="wa-list-toolbar">
                                <label className="wa-search">
                                    <FaSearch aria-hidden="true" />
                                    <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search: courses, usernames" aria-label="Search courses or usernames" />
                                </label>
                                <button type="button" className="wa-new-chat" onClick={openCoursemates}>
                                    <FaUserPlus aria-hidden="true" /> New chat
                                </button>
                                {chatFolder === "favorites" && (
                                    <button
                                        type="button"
                                        className="wa-new-chat wa-add-favorites"
                                        aria-label="Add chats to favorites"
                                        title="Add chats to favorites"
                                        onClick={() => {
                                            setFavoriteSelection(favoriteChatKeys);
                                            setView("favorite-select");
                                        }}
                                    >
                                        <FaPlus aria-hidden="true" /> Add
                                    </button>
                                )}
                            </div>
                            <div className="wa-list-scroll">
                                {visibleChats.map((item) => {
                                    if (item.type === "course") {
                                        const { course } = item;
                                        return (
                                            <div className="wa-conversation-item" key={item.key}>
                                                <button
                                                    type="button"
                                                    className="wa-conversation-row"
                                                    onClick={() => openConversation({
                                                        key: item.key,
                                                        id: course.id,
                                                        type: "course",
                                                        title: course.title,
                                                        studentCount: course.studentCount
                                                    })}
                                                >
                                                    <span className="wa-course-avatar">{course.title.charAt(0).toUpperCase()}</span>
                                                    <span className="wa-conversation-main">
                                                        <strong>{course.title}</strong>
                                                        <small>{course.latestMessage
                                                            ? `${course.latestMessage.senderUsername}: ${messagePreview(course.latestMessage)}`
                                                            : `${course.studentCount} students · Start the conversation`}</small>
                                                    </span>
                                                    <span className="wa-conversation-meta">
                                                        {course.latestMessage && <time>{formatTime(course.latestMessage.createdAt)}</time>}
                                                        {course.unreadCount > 0 && <b>{course.unreadCount}</b>}
                                                    </span>
                                                </button>
                                            </div>
                                        );
                                    }

                                    const { chat } = item;
                                    return (
                                        <div className="wa-conversation-item" key={item.key}>
                                            <button
                                                type="button"
                                                className="wa-conversation-row"
                                                onClick={() => openConversation({
                                                    key: item.key,
                                                    id: chat.profile.id,
                                                    type: "private",
                                                    title: chat.profile.fullName,
                                                    participant: chat.profile
                                                })}
                                            >
                                                <span className="wa-course-avatar wa-private-avatar">{chat.profile.avatarUrl
                                                    ? <img src={chat.profile.avatarUrl} alt="" />
                                                    : <FaUserCircle aria-hidden="true" />}</span>
                                                <span className="wa-conversation-main">
                                                    <strong>{chat.profile.fullName}</strong>
                                                    <small>@{chat.profile.username} · {messagePreview(chat.latestMessage)}</small>
                                                </span>
                                                <span className="wa-conversation-meta">
                                                    <time>{formatTime(chat.latestMessage.createdAt)}</time>
                                                    {chat.unreadCount > 0 && <b>{chat.unreadCount}</b>}
                                                </span>
                                            </button>
                                        </div>
                                    );
                                })}
                                {!visibleChats.length && (
                                    <p className="wa-empty">No conversations match this view or search.</p>
                                )}
                            </div>
                        </>
                    ) : view === "profile" ? (
                        <>
                            <header className="wa-header">
                                <button type="button" className="wa-icon-button" aria-label="Back to chats" onClick={() => setView("list")}><FaArrowLeft /></button>
                                <div className="wa-heading-copy"><h2>Your chat profile</h2><small>Information and view permissions</small></div>
                            </header>
                            {error && <p className="wa-inline-error" role="alert">{error}</p>}
                            <div className="wa-profile-settings-scroll">
                                <div className="wa-profile-summary">
                                    <span className="wa-header-avatar">{profile.avatarUrl
                                        ? <img src={profile.avatarUrl} alt="" />
                                        : <FaUserCircle aria-hidden="true" />}</span>
                                    <div>
                                        <strong>{profile.fullName}</strong>
                                        <span>@{profile.username}</span>
                                        <small>{profile.about || "No about information added."}</small>
                                        <small>{profilePhone ? `Phone: ${profilePhone}` : "No phone number is saved to your account."}</small>
                                        <small>{profileEmail ? `Email: ${profileEmail}` : "No email is saved to your account."}</small>
                                        <small>{profileMatNumber ? `Student number: ${profileMatNumber}` : "No student number is saved to your account."}</small>
                                    </div>
                                </div>
                                {!profileEditing ? <button type="button" className="chat-primary-button" onClick={() => {
                                    setUsername(profile.username);
                                    setAvatarUrl(profile.avatarUrl || "");
                                    setAbout(profile.about || "");
                                    setProfileError("");
                                    setProfileEditing(true);
                                }}>Edit chat profile</button> : (
                                    <form className="chat-profile-modal wa-inline-profile-editor" onSubmit={saveUsername}>
                                        <span className="chat-profile-icon">{avatarUrl
                                            ? <img src={avatarUrl} alt="Chat profile preview" />
                                            : <FaUserCircle />}</span>
                                        <h3>Edit your chat profile</h3>
                                        <div className="chat-profile-picture-options">
                                            <button type="button" className="chat-primary-button" onClick={() => document.getElementById("chat-profile-picture")?.click()}>
                                                Add picture from photos or files
                                            </button>
                                            <button type="button" className="chat-default-picture-button" onClick={() => {
                                                setAvatarUrl("");
                                                setProfileError("");
                                            }}>
                                                Use default app profile picture
                                            </button>
                                            <input
                                                id="chat-profile-picture"
                                                className="chat-hidden-file-input"
                                                type="file"
                                                accept="image/*"
                                                onChange={selectProfilePicture}
                                            />
                                        </div>
                                        <label htmlFor="chat-username">Username</label>
                                        <div className="chat-username-field">
                                            <FaAt aria-hidden="true" />
                                            <input
                                                id="chat-username"
                                                value={username}
                                                onChange={(event) => setUsername(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                                                minLength={3}
                                                maxLength={20}
                                                pattern="[a-z0-9_]{3,20}"
                                                placeholder="e.g. yunusa_bah"
                                                required
                                            />
                                        </div>
                                        <label htmlFor="chat-about">About <span>(optional)</span></label>
                                        <textarea
                                            id="chat-about"
                                            value={about}
                                            onChange={(event) => setAbout(event.target.value)}
                                            maxLength={200}
                                            placeholder="A little about you"
                                        />
                                        {profileError && <p className="chat-error" role="alert">{profileError}</p>}
                                        <div className="wa-profile-editor-actions">
                                            <button className="chat-primary-button" disabled={profileSaving || username.length < 3}>
                                                {profileSaving ? "Saving..." : "Save chat profile"}
                                            </button>
                                            <button type="button" className="chat-default-picture-button" onClick={() => {
                                                setUsername(profile.username);
                                                setAvatarUrl(profile.avatarUrl || "");
                                                setAbout(profile.about || "");
                                                setProfileError("");
                                                setProfileEditing(false);
                                            }}>Cancel</button>
                                        </div>
                                    </form>
                                )}
                                <section className="wa-profile-permissions">
                                    <h3>Private contact information</h3>
                                    <p>Choose who can see each detail: all SmartCampus chat users, students who share a course with you, or people with whom you have a private chat.</p>
                                    {profileSettingsLoading ? (
                                        <p className="wa-empty" role="status">Loading privacy settings...</p>
                                    ) : (
                                        [
                                            ["phoneVisibility", "Phone number", profilePhone],
                                            ["emailVisibility", "Email address", profileEmail],
                                            ["matNumberVisibility", "Matriculation number", profileMatNumber]
                                        ].map(([field, label, value]) => (
                                            <label className="wa-profile-visibility-row" key={field}>
                                                <span>
                                                    <strong>{label}</strong>
                                                    <small>{value || "No value saved to your account"}</small>
                                                </span>
                                                <select
                                                    value={contactVisibility[field]}
                                                    disabled={visibilitySavingField === field}
                                                    onChange={(event) => updateContactVisibility(field, event.target.value)}
                                                    aria-label={`${label} visibility`}
                                                >
                                                    <option value="private_contacts">Private chat contacts only</option>
                                                    <option value="course">Coursemates only</option>
                                                    <option value="everyone">Everyone on SmartCampus</option>
                                                </select>
                                            </label>
                                        ))
                                    )}
                                </section>
                            </div>
                        </>
                    ) : view === "saved" ? (
                        <>
                            <header className="wa-header">
                                <button type="button" className="wa-icon-button" aria-label="Back to chats" onClick={() => setView("list")}><FaArrowLeft /></button>
                                <div className="wa-heading-copy"><h2>Saved messages</h2><small>Visible only to you</small></div>
                            </header>
                            <div className="wa-list-scroll">
                                {!savedMessages.length && <p className="wa-empty">Messages you save will appear here.</p>}
                                {savedMessages.map((message) => {
                                    const course = courses.find((item) => Number(item.id) === Number(message.courseId));
                                    const otherProfileId = message.senderProfileId === profile.id
                                        ? message.receiverProfileId
                                        : message.senderProfileId;
                                    const participant = message.senderProfileId === profile.id
                                        ? (message.receiver || privateChats.find((chat) => chat.profile.id === otherProfileId)?.profile)
                                        : (message.sender || privateChats.find((chat) => chat.profile.id === otherProfileId)?.profile);
                                    const title = course?.title || participant?.fullName || `@${participant?.username || "student"}`;
                                    return (
                                        <button
                                            type="button"
                                            className="wa-saved-row"
                                            key={message.id}
                                            onClick={() => {
                                                if (!course && !participant) {
                                                    setError("This saved conversation is no longer available.");
                                                    return;
                                                }
                                                openConversation(course ? {
                                                    key: `course-${course.id}`,
                                                    id: course.id,
                                                    type: "course",
                                                    title: course.title,
                                                    studentCount: course.studentCount
                                                } : {
                                                    key: `private-${participant.id}`,
                                                    id: participant.id,
                                                    type: "private",
                                                    title: participant.fullName,
                                                    participant
                                                });
                                            }}
                                        >
                                            <span><strong>{title}</strong><small>{messagePreview(message)}</small></span>
                                            <time>{formatTime(message.createdAt)}</time>
                                        </button>
                                    );
                                })}
                            </div>
                        </>
                    ) : view === "search" ? (
                        <>
                            <header className="wa-header">
                                <button type="button" className="wa-icon-button" aria-label="Back to chats" onClick={() => setView("list")}><FaArrowLeft /></button>
                                <div className="wa-heading-copy"><h2>New chat</h2></div>
                            </header>
                            <label className="wa-search wa-coursemate-search">
                                <FaSearch aria-hidden="true" />
                                <input
                                    value={query}
                                    onChange={(event) => {
                                        setQuery(event.target.value);
                                        setUsernameSearchProfile(null);
                                        setUsernameSearchLoading(/^[a-z0-9_]{3,20}$/i.test(
                                            event.target.value.trim().replace(/^@/, "")
                                        ));
                                        setUsernameSearchError("");
                                    }}
                                    placeholder="Search coursemates or @username"
                                    aria-label="Search coursemates or SmartCampus username"
                                />
                            </label>
                            {error && <p className="wa-inline-error" role="alert">{error}</p>}
                            <div className="wa-list-scroll wa-coursemate-list">
                                {coursematesLoading ? (
                                    <p className="wa-empty" role="status">Loading your coursemates...</p>
                                ) : matchingCoursemates.map((member) => (
                                    <button
                                        type="button"
                                        className="wa-conversation-row"
                                        key={member.id}
                                        onClick={() => openConversation({
                                            key: `private-${member.id}`,
                                            id: member.id,
                                            type: "private",
                                            title: member.fullName,
                                            participant: member
                                        })}
                                    >
                                        <span className="wa-course-avatar wa-private-avatar">{member.avatarUrl
                                            ? <img src={member.avatarUrl} alt="" />
                                            : <FaUserCircle aria-hidden="true" />}</span>
                                        <span className="wa-conversation-main">
                                            <strong>{member.fullName}</strong>
                                            <small>@{member.username}{member.about ? ` · ${member.about}` : ""}</small>
                                        </span>
                                    </button>
                                ))}
                                {usernameSearchLoading && (
                                    <p className="wa-empty" role="status">Searching SmartCampus usernames...</p>
                                )}
                                {usernameSearchError && <p className="wa-inline-error" role="alert">{usernameSearchError}</p>}
                                {!usernameSearchLoading && usernameSearchProfile && !usernameSearchIsCoursemate && (
                                    <>
                                        <p className="wa-section-label">SMARTCAMPUS USERS</p>
                                        <button
                                            type="button"
                                            className="wa-conversation-row"
                                            onClick={() => openConversation({
                                                key: `private-${usernameSearchProfile.id}`,
                                                id: usernameSearchProfile.id,
                                                type: "private",
                                                title: usernameSearchProfile.fullName,
                                                participant: usernameSearchProfile
                                            })}
                                        >
                                            <span className="wa-course-avatar wa-private-avatar">{usernameSearchProfile.avatarUrl
                                                ? <img src={usernameSearchProfile.avatarUrl} alt="" />
                                                : <FaUserCircle aria-hidden="true" />}</span>
                                            <span className="wa-conversation-main">
                                                <strong>{usernameSearchProfile.fullName}</strong>
                                                <small>@{usernameSearchProfile.username}{usernameSearchProfile.about
                                                    ? ` · ${usernameSearchProfile.about}`
                                                    : ""}</small>
                                            </span>
                                        </button>
                                    </>
                                )}
                                {!coursematesLoading && !query.trim() && !coursemates.length && (
                                    <p className="wa-empty">No coursemates have created a chat profile yet.</p>
                                )}
                                {!coursematesLoading && query.trim() && !matchingCoursemates.length
                                    && !usernameSearchLoading && !usernameSearchProfile && !usernameSearchError && (
                                        <p className="wa-empty">No coursemates or SmartCampus usernames match your search.</p>
                                    )}
                            </div>
                        </>
                    ) : (
                        <>
                            <header className="wa-header wa-chat-header">
                                <button type="button" className="wa-icon-button" aria-label="Back to chats" onClick={() => {
                                    setView("list");
                                    setActiveChat(null);
                                    setMessages([]);
                                    refresh().catch((requestError) => {
                                        setError(requestError.response?.data?.message || "Unable to update your chat list.");
                                    });
                                }}><FaArrowLeft /></button>
                                <span className="wa-course-avatar">
                                    {activeChat?.participant?.avatarUrl
                                        ? <img src={activeChat.participant.avatarUrl} alt="" />
                                        : <FaUserCircle aria-hidden="true" />}
                                </span>
                                <div className="wa-heading-copy">
                                    <h2>{activeChat?.title}</h2>
                                    <small>{activeChat?.type === "course"
                                        ? `${activeChat.studentCount} students · Group chat · ${
                                            realtimeMode === "supabase" ? "Supabase live" : "Live"
                                        }`
                                        : `@${activeChat?.participant?.username} · ${
                                            onlineProfiles.has(activeChat?.participant?.id) ? "Online" : "Offline"
                                        } · ${realtimeMode === "supabase" ? "Supabase live" : "Live"}`}</small>
                                    {activeChat?.participant?.phone && <small>Phone: {activeChat.participant.phone}</small>}
                                    {activeChat?.participant?.email && <small>Email: {activeChat.participant.email}</small>}
                                    {activeChat?.participant?.matNumber && (
                                        <small>Matriculation number: {activeChat.participant.matNumber}</small>
                                    )}
                                    {activeChat?.type === "private" && (
                                        <button
                                            className="wa-private-contact-toggle"
                                            type="button"
                                            disabled={!privateContactApprovalLoaded || privateContactSaving}
                                            aria-pressed={privateContactApproved}
                                            onClick={updatePrivateContactApproval}
                                        >
                                            {!privateContactApprovalLoaded
                                                ? "Loading privacy..."
                                                : privateContactApproved
                                                    ? "Stop sharing private details"
                                                    : "Allow this contact to see private details"}
                                        </button>
                                    )}
                                </div>
                            </header>
                            {typingUsers.length > 0 && (
                                <div className="wa-typing-indicator" role="status">
                                    {typingUsers.length === 1
                                        ? `${typingUsers[0].username} is typing…`
                                        : `${typingUsers.length} students are typing…`}
                                </div>
                            )}
                            {error && <p className="wa-inline-error" role="alert">{error}</p>}
                            <div className="wa-message-list" ref={scrollRef}>
                                {!messages.length && <div className="wa-welcome">
                                    <strong>{activeChat?.type === "course" ? "Course group chat" : "Private chat"}</strong>
                                    <span>Messages are visible only to students with access to this conversation.</span>
                                </div>}
                                {messagesWithDividers.map((entry) => {
                                    if (entry.type === "day") {
                                        return <div className="wa-day-divider" key={entry.key}><span>{entry.label}</span></div>;
                                    }
                                    if (entry.type === "unread") {
                                        return <div className="wa-unread-divider" key={entry.key}><span>New messages</span></div>;
                                    }
                                    const { message } = entry;
                                    const own = message.senderProfileId === profile.id;
                                    return (
                                        <article
                                            key={entry.key}
                                            className={`wa-message wa-message-${message.type}${own ? " wa-message-own" : ""}`}
                                            onContextMenu={(event) => {
                                                event.preventDefault();
                                                setContextMessage(message);
                                            }}
                                            onDoubleClick={() => setContextMessage(message)}
                                            onTouchStart={(event) => {
                                                const timer = window.setTimeout(() => setContextMessage(message), 650);
                                                event.currentTarget.dataset.longPressTimer = String(timer);
                                            }}
                                            onTouchEnd={(event) => {
                                                window.clearTimeout(Number(event.currentTarget.dataset.longPressTimer));
                                                const now = Date.now();
                                                if (lastTouchRef.current.messageId === message.id &&
                                                    now - lastTouchRef.current.at < 350) {
                                                    setContextMessage(message);
                                                    lastTouchRef.current = { messageId: null, at: 0 };
                                                } else {
                                                    lastTouchRef.current = { messageId: message.id, at: now };
                                                }
                                            }}
                                        >
                                            {activeChat?.type === "course" && !own && (
                                                <strong className="wa-sender-name">@{message.sender?.username || "student"}</strong>
                                            )}
                                            {message.reply && <div className="wa-reply-quote">{message.reply.content}</div>}
                                            {(message.type === "gif" || message.type === "sticker") ? (
                                                <img className="wa-media-message" src={message.content} alt={message.type === "gif" ? "Shared GIF" : "Shared sticker"} loading="lazy" />
                                            ) : message.type === "voice" ? (
                                                mediaSources[message.id]
                                                    ? <audio className="wa-voice-note" controls preload="metadata" src={mediaSources[message.id]} aria-label="Voice note" />
                                                    : <span className="wa-voice-loading">Loading voice note…</span>
                                            ) : message.type === "image" ? (
                                                mediaSources[message.id]
                                                    ? <div className="wa-local-media">
                                                        <img className="wa-media-message" src={mediaSources[message.id]} alt={message.content || "Shared image"} loading="lazy" />
                                                        <button type="button" onClick={() => downloadMessageMedia(message)} aria-label="Save photo to this device" title="Save photo">
                                                            <FaDownload aria-hidden="true" />
                                                        </button>
                                                    </div>
                                                    : <span className="wa-voice-loading">Loading image…</span>
                                            ) : message.type === "file" ? (
                                                mediaSources[message.id]
                                                    ? <a className="wa-file-message" href={mediaSources[message.id]} download={message.content}><FaFile aria-hidden="true" /> {message.content}</a>
                                                    : <span className="wa-voice-loading">Loading file…</span>
                                            ) : message.type === "contact" ? (() => {
                                                const contact = parseContactCard(message.content);
                                                return contact ? (
                                                    <div className="wa-contact-card">
                                                        <span className="wa-course-avatar wa-private-avatar">{contact.avatarUrl
                                                            ? <img src={contact.avatarUrl} alt="" />
                                                            : <FaUserCircle aria-hidden="true" />}</span>
                                                        <strong>{contact.fullName}</strong>
                                                        <small>@{contact.username}</small>
                                                        {contact.about && <p>{contact.about}</p>}
                                                    </div>
                                                ) : <p>Contact card unavailable.</p>;
                                            })() : (
                                                <p>{message.content.split(/(@[a-z0-9_]{3,20})/gi).map((part, index) =>
                                                    part.startsWith("@")
                                                        ? <span className="wa-mention" key={`${message.id}-mention-${index}`}>{part}</span>
                                                        : part
                                                )}</p>
                                            )}
                                            <div className="wa-message-meta">
                                                <time>{formatTime(message.createdAt)}</time>
                                                {own && message.receiverProfileId && message.deliveredAt
                                                    ? <FaCheckDouble className={message.isRead ? "wa-read-tick" : "wa-delivered-tick"} aria-label={message.isRead ? "Seen" : "Delivered"} />
                                                    : own && <FaCheck aria-label="Sent" />}
                                            </div>
                                            {message.reactions?.length > 0 && (
                                                <div className="wa-message-reactions" aria-label="Message reactions">
                                                    {message.reactions.map((reaction) => (
                                                        <button
                                                            type="button"
                                                            key={reaction.emoji}
                                                            className={reaction.reactedByMe ? "is-reacted" : ""}
                                                            aria-label={`${reaction.emoji}, ${reaction.count} reactions`}
                                                            onClick={() => toggleReaction(message, reaction.emoji)}
                                                        >
                                                            {reaction.emoji}<span>{reaction.count}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                            {contextMessage?.id === message.id && (
                                                <div className="wa-context-menu" role="menu">
                                                    <div className="wa-quick-reactions" aria-label="Add reaction">
                                                        {["👍", "❤️", "😂", "😮", "😢", "🙏"].map((emoji) => (
                                                            <button type="button" key={emoji} aria-label={`React ${emoji}`} onClick={() => toggleReaction(message, emoji)}>{emoji}</button>
                                                        ))}
                                                    </div>
                                                    <button type="button" onClick={() => { setReplyTo(message); setContextMessage(null); draftRef.current?.focus(); }}><FaReply /> Reply</button>
                                                    <button type="button" onClick={() => copyMessage(message)}><FaCopy /> Copy</button>
                                                    {["image", "file"].includes(message.type) && <button type="button" onClick={() => downloadMessageMedia(message)}><FaDownload /> Save to device</button>}
                                                    <button type="button" onClick={() => toggleSaveMessage(message)}>
                                                        <FaBookmark /> {savedMessages.some((item) => item.id === message.id) ? "Unsave" : "Save"}
                                                    </button>
                                                    <button type="button" onClick={() => deleteForMe(message)}><FaTrash /> Delete for me</button>
                                                </div>
                                            )}
                                        </article>
                                    );
                                })}
                            </div>
                            {mentionChoices.length > 0 && (
                                <div className="wa-mention-options">
                                    {mentionChoices.map((member) => (
                                        <button type="button" key={member.id} onClick={() => chooseMention(member)}>
                                            <span>@{member.username}</span><small>{member.fullName}</small>
                                        </button>
                                    ))}
                                </div>
                            )}
                            {replyTo && (
                                <div className="wa-reply-preview">
                                    <span><strong>Replying to @{replyTo.sender?.username || activeChat?.participant?.username}</strong><small>{messagePreview(replyTo)}</small></span>
                                    <button type="button" aria-label="Cancel reply" onClick={() => setReplyTo(null)}><FaTimes /></button>
                                </div>
                            )}
                            {showEmoji && (
                                <div className="wa-emoji-popover">
                                    <nav className="wa-picker-tabs" aria-label="Message picker">
                                        {[
                                            ["emoji", "Emoji"],
                                            ["gif", "GIFs"],
                                            ["sticker", "Stickers"],
                                            ["saved", "Saved"]
                                        ].map(([tab, label]) => (
                                            <button
                                                type="button"
                                                key={tab}
                                                className={mediaTab === tab ? "active" : ""}
                                                aria-pressed={mediaTab === tab}
                                                onClick={() => {
                                                    setMediaTab(tab);
                                                    if (tab === "gif" || tab === "sticker") {
                                                        setMediaType(tab);
                                                        setMediaResults([]);
                                                    }
                                                }}
                                            >{label}</button>
                                        ))}
                                    </nav>
                                    {mediaTab === "emoji" ? (
                                        <EmojiPicker
                                            onEmojiClick={(item) => sendMessage(null, { content: item.emoji, type: "emoji" })}
                                            theme={document.documentElement.dataset.theme === "dark" ? "dark" : "light"}
                                            height={300}
                                            width="100%"
                                        />
                                    ) : mediaTab === "saved" ? (
                                        <div className="wa-media-results">
                                            {savedMedia.map((item) => (
                                                <div className="wa-media-choice" key={item.key}>
                                                    <button
                                                        type="button"
                                                        aria-label={`Send saved ${item.type}`}
                                                        onClick={() => sendMessage(null, { content: item.url, type: item.type })}
                                                    ><img src={item.previewUrl} alt="" loading="lazy" /></button>
                                                    <button
                                                        type="button"
                                                        className="wa-media-save"
                                                        aria-label={`Remove saved ${item.type}`}
                                                        onClick={() => toggleMediaSaved(item, item.type)}
                                                    ><FaBookmark aria-hidden="true" /></button>
                                                </div>
                                            ))}
                                            {!savedMedia.length && <span>Save GIFs and stickers here for quick access.</span>}
                                        </div>
                                    ) : (
                                        <>
                                            <form className="wa-media-search" onSubmit={searchMedia}>
                                                <input
                                                    value={mediaQuery}
                                                    onChange={(event) => setMediaQuery(event.target.value)}
                                                    placeholder={`Search ${mediaTab === "gif" ? "GIFs" : "stickers"}`}
                                                    aria-label={`Search ${mediaTab === "gif" ? "GIFs" : "stickers"}`}
                                                />
                                                <button className="chat-primary-button" type="submit" disabled={mediaSearching || mediaQuery.trim().length < 2}>
                                                    {mediaSearching ? "Searching…" : "Search"}
                                                </button>
                                            </form>
                                            <div className="wa-media-results">
                                                {mediaResults.map((item) => {
                                                    const saved = savedMedia.some((media) => media.key === `${mediaType}:${item.id}`);
                                                    return (
                                                        <div className="wa-media-choice" key={item.id}>
                                                            <button
                                                                type="button"
                                                                aria-label={`Send ${mediaType}`}
                                                                onClick={() => sendMessage(null, { content: item.url, type: mediaType })}
                                                            ><img src={item.previewUrl} alt="" loading="lazy" /></button>
                                                            <button
                                                                type="button"
                                                                className={`wa-media-save${saved ? " is-saved" : ""}`}
                                                                aria-label={saved ? `Remove saved ${mediaType}` : `Save ${mediaType}`}
                                                                aria-pressed={saved}
                                                                onClick={() => toggleMediaSaved(item, mediaType)}
                                                            ><FaBookmark aria-hidden="true" /></button>
                                                        </div>
                                                    );
                                                })}
                                                {!mediaSearching && !mediaResults.length && <span>Search for something to share.</span>}
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                            {showAttachments && (
                                <div className="wa-attachment-popover">
                                    <div className="wa-attachment-options">
                                        <button type="button" onClick={() => {
                                            setShowAttachments(false);
                                            imageInputRef.current?.click();
                                        }}><FaImage aria-hidden="true" /> Add image</button>
                                        <button type="button" onClick={() => {
                                            setShowAttachments(false);
                                            fileInputRef.current?.click();
                                        }}><FaFile aria-hidden="true" /> Add file</button>
                                        <button type="button" onClick={() => {
                                            setShowAttachments(false);
                                            setMediaTab("gif");
                                            setMediaType("gif");
                                            setShowEmoji(true);
                                        }}><FaPaperclip aria-hidden="true" /> GIF or sticker</button>
                                        <button type="button" onClick={async () => {
                                            setShowAttachments("contacts");
                                            await fetchCoursemates();
                                        }}>
                                            <FaAddressCard aria-hidden="true" /> Add contact
                                        </button>
                                    </div>
                                    {showAttachments === "contacts" && (
                                        <div className="wa-attachment-contacts">
                                            {coursematesLoading
                                                ? <span>Loading coursemates...</span>
                                                : !coursemates.length && <span>No coursemate contacts available.</span>}
                                            {!coursematesLoading && coursemates.map((member) => (
                                                <button type="button" key={member.id} onClick={() => sendContact(member)}>
                                                    {member.avatarUrl
                                                        ? <img src={member.avatarUrl} alt="" />
                                                        : <FaUserCircle aria-hidden="true" />}
                                                    <span>{member.fullName}<small>@{member.username}</small></span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                            <input
                                ref={imageInputRef}
                                className="chat-hidden-file-input"
                                type="file"
                                accept="image/jpeg,image/png,image/webp,image/gif"
                                onChange={(event) => {
                                    const file = event.target.files?.[0];
                                    event.target.value = "";
                                    sendAttachment(file, "image");
                                }}
                            />
                            <input
                                ref={fileInputRef}
                                className="chat-hidden-file-input"
                                type="file"
                                onChange={(event) => {
                                    const file = event.target.files?.[0];
                                    event.target.value = "";
                                    sendAttachment(file, "file");
                                }}
                            />
                            <form className="wa-compose" onSubmit={sendMessage}>
                                <button type="button" className="wa-compose-icon" aria-label="Choose emoji" onClick={() => {
                                    setShowAttachments(false);
                                    setMediaTab("emoji");
                                    setShowEmoji((current) => !current);
                                }}><FaSmile /></button>
                                <button type="button" className="wa-compose-icon" aria-label="Add attachment" onClick={() => {
                                    setShowEmoji(false);
                                    setShowAttachments((current) => current ? false : true);
                                }}><FaPaperclip /></button>
                                <input
                                    ref={draftRef}
                                    value={draft}
                                    onChange={onDraftChange}
                                    onFocus={() => setContextMessage(null)}
                                    placeholder="Type a message, use @ to mention"
                                    maxLength={4000}
                                    aria-label="Message"
                                />
                                {recording && <span className="wa-recording-time" role="status">Recording {recordingSeconds}s</span>}
                                {!draft.trim() ? (
                                    <button
                                        type="button"
                                        className={`wa-send-button${recording ? " is-recording" : ""}`}
                                        disabled={sending}
                                        aria-label={recording ? "Stop and send voice note" : "Record voice note"}
                                        onClick={toggleRecording}
                                    >
                                        {recording ? <FaStop /> : <FaMicrophone />}
                                    </button>
                                ) : (
                                    <button type="submit" className="wa-send-button" disabled={sending} aria-label="Send message">
                                        <FaPaperPlane />
                                    </button>
                                )}
                            </form>
                        </>
                    )}
                </section>
            )}
        </>
    );
};

export default FloatingChat;
