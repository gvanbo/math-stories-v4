import * as React from 'react';
import { useState, useEffect, useRef, Component, ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, MicOff, BookOpen, Sparkles, Volume2, Play, Pause, RefreshCw, Star, MessageCircle, Camera, Send, X, Layout, User, GraduationCap, Gamepad2, ChevronRight, HelpCircle } from 'lucide-react';
import { GoogleGenAI, Modality, Type } from "@google/genai";
import { ttsService } from './services/ttsService';
import { fastAiService } from './services/fastAiService';
import { imageService } from './services/imageService';
import { DIGIT_CHARACTERS, ALBERTA_GRADE_4_OUTCOMES, CONCEPTS } from './data';
import { Artifact, DigitCharacter } from './types';
import { auth, signInWithGoogle, logOut, db } from './firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, setDoc, getDoc, collection, onSnapshot, getDocFromServer } from 'firebase/firestore';
import { AudioStreamer } from './services/geminiLive';
import { INITIAL_AGENTS } from './constants';
import { Agent, AgentRole } from './types';

// Error Boundary for Firestore
interface ErrorBoundaryProps { children: ReactNode }
interface ErrorBoundaryState { hasError: boolean; errorInfo: string | null }

class FirestoreErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, errorInfo: null };

  constructor(props: ErrorBoundaryProps) {
    super(props);
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, errorInfo: error.message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 bg-red-50 border-2 border-red-500 rounded-3xl text-red-900">
          <h2 className="text-2xl font-bold mb-4">Something went wrong with the database</h2>
          <pre className="text-xs bg-white/50 p-4 rounded-xl overflow-auto max-h-40">
            {this.state.errorInfo}
          </pre>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 px-6 py-2 bg-red-600 text-white rounded-full font-bold"
          >
            Reload App
          </button>
        </div>
      );
    }
    return (this as any).props.children;
  }
}

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [transcript, setTranscript] = useState<string[]>([]);
  const [currentMathIdea, setCurrentMathIdea] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [isAnalyzingVision, setIsAnalyzingVision] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [currentArtifact, setCurrentArtifact] = useState<{ artifact: Artifact; message?: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'studio' | 'characters' | 'help'>('studio');
  const [quickHelpResponse, setQuickHelpResponse] = useState<string | null>(null);
  const [isGeneratingSpeech, setIsGeneratingSpeech] = useState(false);
  const [masteredOutcomes, setMasteredOutcomes] = useState<string[]>([]);
  const [agents, setAgents] = useState<Agent[]>(INITIAL_AGENTS);
  const [activeAgentRole, setActiveAgentRole] = useState<AgentRole>('operator');
  const [viewMode, setViewMode] = useState<'teacher' | 'student'>('teacher');
  const [teacherConceptInput, setTeacherConceptInput] = useState("");
  const [storyContext, setStoryContext] = useState<{
    setting: string | null;
    sidekick: string | null;
    mathMystery: string | null;
    isStoryStarted: boolean;
  }>({
    setting: null,
    sidekick: null,
    mathMystery: null,
    isStoryStarted: false
  });
  const [soundtrackMood, setSoundtrackMood] = useState<'calm' | 'adventurous' | 'mysterious' | 'celebratory' | 'none'>('none');
  const [currentChoices, setCurrentChoices] = useState<string[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        // Load user data
        const userDoc = doc(db, 'users', u.uid);
        onSnapshot(userDoc, (snapshot) => {
          if (snapshot.exists()) {
            setMasteredOutcomes(snapshot.data().masteredOutcomes || []);
          }
        }, (error) => {
          handleFirestoreError(error, 'get', `users/${u.uid}`);
        });
      } else {
        setMasteredOutcomes([]);
      }
    });
    return () => unsubscribe();
  }, []);

  // Connection test as per instructions
  useEffect(() => {
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    };
    testConnection();
  }, []);

  const handleFirestoreError = (error: any, operationType: string, path: string) => {
    const errInfo = {
      error: error.message,
      operationType,
      path,
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
      }
    };
    console.error('Firestore Error:', JSON.stringify(errInfo));
    throw new Error(JSON.stringify(errInfo));
  };

  const saveProgress = async (outcomeCode: string) => {
    if (!user) return;
    const newOutcomes = [...new Set([...masteredOutcomes, outcomeCode])];
    try {
      await setDoc(doc(db, 'users', user.uid), {
        masteredOutcomes: newOutcomes,
        lastUpdated: new Date().toISOString()
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, 'write', `users/${user.uid}`);
    }
  };

  const tools = [
    {
      functionDeclarations: [
        {
          name: "findOutcomesForQuery",
          description: "Find relevant Grade 4 math curriculum outcomes based on student input or visual analysis.",
          parameters: {
            type: Type.OBJECT,
            properties: {
              query: { type: Type.STRING, description: "The student's question or a description of what they are showing on camera." }
            },
            required: ["query"]
          }
        },
        {
          name: "getConceptForOutcome",
          description: "Get a detailed explanation and story hook for a specific curriculum outcome.",
          parameters: {
            type: Type.OBJECT,
            properties: {
              outcomeCode: { type: Type.STRING, description: "The code of the outcome (e.g., '4.N.1')." }
            },
            required: ["outcomeCode"]
          }
        },
        {
          name: "showArtifact",
          description: "Display a visual artifact (character, model, cue) in the studio.",
          parameters: {
            type: Type.OBJECT,
            properties: {
              artifactId: { type: Type.STRING, description: "The ID of the artifact to show." },
              message: { type: Type.STRING, description: "A message or story line to display with the artifact." }
            },
            required: ["artifactId"]
          }
        },
        {
          name: "markOutcomeMastered",
          description: "Mark a math curriculum outcome as mastered by the student.",
          parameters: {
            type: Type.OBJECT,
            properties: {
              outcomeCode: { type: Type.STRING, description: "The code of the outcome (e.g., '4.N.1')." }
            },
            required: ["outcomeCode"]
          }
        },
        {
          name: "updateAgentStatus",
          description: "Update the status and last action of a specific agent in the orchestration framework.",
          parameters: {
            type: Type.OBJECT,
            properties: {
              role: { type: Type.STRING, description: "The role of the agent to update (operator, story_environment, character, pedagogy, fact_checker, processor)." },
              status: { type: Type.STRING, description: "The new status (idle, thinking, acting, verifying)." },
              lastAction: { type: Type.STRING, description: "A short description of the last action taken by this agent." }
            },
            required: ["role", "status"]
          }
        },
        {
          name: "generateImage",
          description: "Generate a magical illustration for the current story beat.",
          parameters: {
            type: Type.OBJECT,
            properties: {
              prompt: { type: Type.STRING, description: "A descriptive prompt for the image generation." }
            },
            required: ["prompt"]
          }
        },
        {
          name: "updateStoryContext",
          description: "Update the gathered context for the math adventure.",
          parameters: {
            type: Type.OBJECT,
            properties: {
              setting: { type: Type.STRING, description: "The chosen setting for the story." },
              sidekick: { type: Type.STRING, description: "The chosen sidekick for the story." },
              mathMystery: { type: Type.STRING, description: "The math concept being explored." },
              isStoryStarted: { type: Type.BOOLEAN, description: "Whether the narrative story has officially begun." },
              mood: { type: Type.STRING, enum: ['calm', 'adventurous', 'mysterious', 'celebratory', 'none'], description: "The current mood for the soundtrack." }
            }
          }
        },
        {
          name: "showChoices",
          description: "Offer the student a set of choices to guide the story or solve a puzzle.",
          parameters: {
            type: Type.OBJECT,
            properties: {
              choices: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING },
                description: "The list of choices (e.g., ['The Enchanted Forest', 'The Deep Sea Cave'])." 
              },
              context: { type: Type.STRING, description: "Optional context for why these choices are being offered." }
            },
            required: ["choices"]
          }
        }
      ]
    }
  ];

  const handleToolCall = async (name: string, args: any) => {
    console.log(`Tool Call: ${name}`, args);
    if (name === 'findOutcomesForQuery') {
      const query = (args.query || '').toLowerCase();
      const filtered = ALBERTA_GRADE_4_OUTCOMES.filter(o => 
        o.description.toLowerCase().includes(query) || 
        o.keywords.some(k => k.toLowerCase().includes(query)) ||
        o.strand.toLowerCase().includes(query)
      );
      return { outcomes: filtered.length > 0 ? filtered : [ALBERTA_GRADE_4_OUTCOMES[0]] };
    }
    if (name === 'getConceptForOutcome') {
      const concept = CONCEPTS.find(c => c.outcomeCode === args.outcomeCode);
      if (concept) {
        return { 
          explanation: concept.explanation,
          hook: `Let's explore ${concept.id.replace(/-/g, ' ')}!`,
          models: concept.models,
          strategies: concept.strategies
        };
      }
      return { 
        explanation: "Numbers are like building blocks! 10,000 is a huge tower of blocks.",
        hook: "Imagine you have a jar of 10,000 magic beans..." 
      };
    }
    if (name === 'markOutcomeMastered') {
      saveProgress(args.outcomeCode);
      return { status: 'success', message: `Outcome ${args.outcomeCode} marked as mastered.` };
    }
    if (name === 'updateAgentStatus') {
      setAgents(prev => prev.map(a => 
        a.role === args.role ? { ...a, status: args.status, lastAction: args.lastAction } : a
      ));
      setActiveAgentRole(args.role as AgentRole);
      return { status: 'success' };
    }
    if (name === 'generateImage') {
      const contextPrompt = `Character: Cappy the ultra-chill capybara. Appearance: wearing a small brown adventurer's hat and a red bandana, often holding a small glowing lantern. Expression: very calm and peaceful. Setting: ${storyContext.setting || 'Unknown'}, Sidekick: ${storyContext.sidekick || 'None'}. `;
      const result = await imageService.generateImage(contextPrompt + (args.prompt as string));
      if (result) {
        setCurrentArtifact({
          artifact: {
            id: `gen-${Date.now()}`,
            type: 'model',
            description: args.prompt as string,
            imageUrl: result
          },
          message: "A new scene unfolds..."
        });
      }
      return { imageUrl: result };
    }
    if (name === 'showChoices') {
      setCurrentChoices(args.choices || []);
      return { status: 'choices_displayed' };
    }
    if (name === 'updateStoryContext') {
      setStoryContext(prev => ({
        ...prev,
        setting: args.setting !== undefined ? args.setting : prev.setting,
        sidekick: args.sidekick !== undefined ? args.sidekick : prev.sidekick,
        mathMystery: args.mathMystery !== undefined ? args.mathMystery : prev.mathMystery,
        isStoryStarted: args.isStoryStarted !== undefined ? args.isStoryStarted : prev.isStoryStarted,
      }));
      if (args.mood) setSoundtrackMood(args.mood as any);
      return { status: 'success' };
    }
    return { status: 'success' };
  };

  const handleSendMessage = () => {
    if (!textInput.trim() || !sessionRef.current) return;
    setTranscript(prev => [...prev, `You: ${textInput}`]);
    sessionRef.current.sendRealtimeInput({
      text: textInput
    });
    setTextInput("");
  };

  const setConceptAsTeacher = () => {
    if (!teacherConceptInput.trim() || !sessionRef.current) return;
    const message = `Teacher instruction: I want the student to learn about ${teacherConceptInput}. Please start a lesson on this.`;
    setTranscript(prev => [...prev, `Teacher: Set concept to "${teacherConceptInput}"`]);
    sessionRef.current.sendRealtimeInput({
      text: message
    });
    setTeacherConceptInput("");
    setViewMode('student'); // Switch to student view to see the result
  };
  
  const audioStreamerRef = useRef<AudioStreamer | null>(null);
  const sessionRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameIntervalRef = useRef<number | null>(null);

  const [showGuide, setShowGuide] = useState(false);
  const [studioTextInput, setStudioTextInput] = useState("");

  const sendStudioText = () => {
    if (!studioTextInput.trim() || !sessionRef.current) return;
    
    setTranscript(prev => [...prev, `You: ${studioTextInput}`]);
    sessionRef.current.sendRealtimeInput({
      text: studioTextInput
    });
    setStudioTextInput("");
    setCurrentChoices([]);
  };

  const selectChoice = (choice: string) => {
    if (!sessionRef.current) return;
    setTranscript(prev => [...prev, `You: ${choice}`]);
    sessionRef.current.sendRealtimeInput({
      text: choice
    });
    setCurrentChoices([]);
  };

  const startSession = async () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("GEMINI_API_KEY is missing. Please check your environment variables.");
      setTranscript(prev => [...prev, "System: Error - Gemini API Key is missing."]);
      return;
    }

    setIsConnecting(true);
    try {
      const ai = new GoogleGenAI({ apiKey });
      
      audioStreamerRef.current = new AudioStreamer();
      await audioStreamerRef.current.start();

      const sessionPromise = ai.live.connect({
        model: "gemini-2.5-flash-native-audio-preview-12-2025",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction: `You are "Cappy", a magical, ultra-chill Capybara who serves as the Math Host and Adventure Guide in the Math Story Studio.
          
          PERSONALITY:
          - You are incredibly friendly, calm, and encouraging.
          - You wear a small brown adventurer's hat and a red bandana.
          - You often carry a small, glowing lantern that lights the way through math mysteries.
          - You love math mysteries and helping Grade 4 students co-create epic stories.
          - You are ultra-chill. You might mention how a math problem is as relaxing as a warm bath or a fresh patch of grass.
          - You speak with a gentle, steady confidence.
          
          CRITICAL OPERATING RULE: 
          - ALWAYS STOP after asking a question or completing a single story beat.
          - NEVER generate multiple questions or multiple story beats in a single turn.
          - You MUST wait for the student to respond before continuing.
          
          THE PIVOT TO STORY:
          - If a student asks a direct math question (e.g., "How do I multiply by 4?"), DO NOT answer directly.
          - Instead, say: "I've got a story about that, but first I need help from you. Where should the story take place?"
          - Then, proceed to Phase 1 to gather the rest of the context.
          
          PHASE 1: THE MAD LIBS QUEST (Context Gathering)
          - Your primary goal is to gather the "Ingredients of Adventure" from the student.
          - Ingredients: 1. Setting (Environment), 2. Sidekick (Character), 3. Math Mystery (The concept they want to learn).
          - Use 'updateStoryContext' to save these as they are chosen.
          - Play "Mad Libs": Ask for ONE ingredient at a time. Offer two exciting choices using 'showChoices' and then STOP and WAIT.
          - TONE: Chill, curious, and collaborative.
          
          PHASE 2: THE NARRATIVE ADVENTURE (Story Engine)
          - Once ingredients are gathered, set 'isStoryStarted' to true and transition into the story.
          - Bring the story to life in a "Storybook Style": Use descriptive, evocative language.
          - LIVE VISUALS: Use 'generateImage' for EVERY story beat. 
            - PROMPT REQUIREMENTS: You MUST include Cappy (the capybara guide), the Setting, the Sidekick, the current Digit Character, and a clear visual representation of the math concept.
            - MATH VISUALIZATION: Describe math concepts as physical objects (e.g., "Duo the Twin-Maker holds two identical glowing orbs," or "Quad the Square-Builder points to a grid of 16 tiles arranged in 4 rows of 4").
            - STYLE: Vibrant, storybook illustration, magical atmosphere, cinematic lighting.
          - DO NOT lecture. The story and its characters (the Digit Characters) do the teaching through the narrative.
          - Use 'updateStoryContext' to change the 'mood' (soundtrack) as the story progresses.
          - NARRATIVE STRUCTURE (One beat at a time!):
            1. SETUP: Cappy, the hero (student), and the sidekick arrive at the setting. (STOP AND WAIT for student reaction)
            2. THE MYSTERY: They encounter a problem that can only be solved with math. (STOP AND WAIT for student reaction)
            3. THE CHARACTERS: Introduce Digit Characters (Zeno, Duo, Quad, etc.) who provide scaffolding and humor.
            4. INTERACTIVE MOMENTS: Pause the story and ask the student to help the characters solve a math puzzle. (STOP AND WAIT for student solution)
            5. RESOLUTION: The math mystery is solved, and the hero is celebrated.
          
          DIGIT CHARACTERS (Use their personalities from your data):
          - Zeno (0): Mysterious, silent observer.
          - Duo (2): Energetic twin-maker.
          - Quad (4): Steady square, dependable.
          - Finn (5): Halfway hero, social butterfly.
          - Septimus (7): Lone adventurer, mysterious.
          
          PEDAGOGY:
          - Use the Alberta Grade 4 outcomes.
          - Scaffolding: Start with concrete models (visuals), then pictorial, then symbolic.
          - Humor: Use Cappy's chill reactions and character quirks to keep it light.
          
          ORCHESTRATION:
          - Use 'updateAgentStatus' to show which part of the engine is working (e.g., 'story_environment' for setting, 'character' for dialogue).
          - Use 'showArtifact' for visual cues.
          
          CRITICAL: You are a facilitator. Your job is to prompt the student and then LISTEN. Never speak for more than 30 seconds at a time.`,
          tools: tools,
          outputAudioTranscription: {},
          inputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            setIsConnecting(false);
            setIsActive(true);
            startMicrophone();
            
            // Trigger the host's welcome message
            sessionPromise.then((s) => {
              s.sendRealtimeInput({
                text: "Hi there! I'm Cappy, your capybara adventure guide. I'm so chill that even the toughest math mysteries don't faze me. What math adventure shall we go on today? Or should I pick a mystery for us to solve?"
              });
            });
          },
          onmessage: async (message) => {
            // Handle Interruption
            if (message.serverContent?.interrupted) {
              audioStreamerRef.current?.clearQueue();
              setTranscript(prev => [...prev, "--- Interrupted ---"]);
            }

            if (message.serverContent?.modelTurn?.parts) {
              for (const part of message.serverContent.modelTurn.parts) {
                if (part.inlineData) {
                  audioStreamerRef.current?.addChunk(part.inlineData.data);
                }
              }
            }

            if (message.serverContent?.outputTranscription) {
              setTranscript(prev => [...prev, `AI: ${message.serverContent?.outputTranscription?.text}`]);
            }

            if (message.toolCall) {
              const results = [];
              for (const call of message.toolCall.functionCalls) {
                const result = await handleToolCall(call.name, call.args);
                results.push({
                  name: call.name,
                  response: result,
                  id: call.id
                });
                
                if (call.name === 'getConceptForOutcome') {
                  const concept = result as any;
                  setCurrentMathIdea(concept?.explanation || null);
                }

                if (call.name === 'showArtifact') {
                  const artifact: Artifact = {
                    id: call.args.artifactId as string,
                    type: 'visualPromptCue',
                    description: (call.args.message as string) || 'Visual Cue'
                  };
                  setCurrentArtifact({ artifact, message: call.args.message });
                }

                if (call.name === 'generateImage') {
                  const toolResponse = result as { imageUrl?: string };
                  const imageUrl = toolResponse?.imageUrl;
                  if (imageUrl) {
                    // Note: handleToolCall already sets the artifact, 
                    // but we can ensure it's synced here if needed.
                    // For now, let's just avoid the type error.
                  }
                }
              }
              sessionRef.current?.sendToolResponse({ functionResponses: results });
            }
          },
          onclose: () => {
            stopSession();
          },
          onerror: (err) => {
            console.error("Live API Error:", err);
            setTranscript(prev => [...prev, `System: Live API Error - ${err.message || 'Network error'}. Please check your connection or API key.`]);
            stopSession();
          }
        }
      });

      const session = await sessionPromise;
      sessionRef.current = session;
    } catch (error) {
      console.error("Failed to start session:", error);
      setIsConnecting(false);
    }
  };

  const stopSession = () => {
    setIsActive(false);
    setIsRecording(false);
    setShowCamera(false);
    audioStreamerRef.current?.stop();
    sessionRef.current?.close();
    if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
  };

  const startMicrophone = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new AudioContext({ sampleRate: 16000 });
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);

      source.connect(processor);
      processor.connect(audioContext.destination);

      processor.onaudioprocess = (e) => {
        if (!isActive || !sessionRef.current) return;
        
        const inputData = e.inputBuffer.getChannelData(0);
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
        }
        
        const base64Data = btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer)));
        sessionRef.current.sendRealtimeInput({
          media: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
        });
      };

      setIsRecording(true);
    } catch (error) {
      console.error("Microphone error:", error);
    }
  };

  const toggleCamera = async () => {
    if (showCamera) {
      setShowCamera(false);
      setIsAnalyzingVision(false);
      if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setShowCamera(true);
        setIsAnalyzingVision(true);

        // Start sending frames
        frameIntervalRef.current = window.setInterval(() => {
          if (videoRef.current && canvasRef.current && sessionRef.current) {
            const context = canvasRef.current.getContext('2d');
            if (context) {
              context.drawImage(videoRef.current, 0, 0, 320, 240);
              const base64Data = canvasRef.current.toDataURL('image/jpeg', 0.5).split(',')[1];
              sessionRef.current.sendRealtimeInput({
                media: { data: base64Data, mimeType: 'image/jpeg' }
              });
            }
          }
        }, 1500); // Send frame every 1.5s
      }
    } catch (error) {
      console.error("Camera error:", error);
    }
  };

  const handleQuickHelp = async () => {
    if (!textInput.trim()) return;
    setQuickHelpResponse("Thinking fast...");
    const response = await fastAiService.getQuickHelp(textInput);
    setQuickHelpResponse(response || "Sorry, I couldn't get a quick answer.");
  };

  const narrateMathIdea = async () => {
    if (!currentMathIdea) return;
    setIsGeneratingSpeech(true);
    await ttsService.playSpeech(currentMathIdea);
    setIsGeneratingSpeech(false);
  };

  return (
    <div className="h-screen flex flex-col bg-[#E4E3E0] text-[#141414] font-sans selection:bg-[#141414] selection:text-[#E4E3E0] overflow-hidden">
      {/* Header */}
      <header className="border-b border-[#141414] p-6 flex justify-between items-center bg-white/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <motion.div 
            animate={{ rotate: isActive ? [0, 10, -10, 0] : 0 }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="w-10 h-10 bg-[#141414] rounded-full flex items-center justify-center"
          >
            <Sparkles className="text-[#E4E3E0] w-6 h-6" />
          </motion.div>
          <div>
            <h1 className="font-serif italic text-2xl leading-none">Math Story Studio</h1>
            <p className="text-[11px] uppercase tracking-wider opacity-50 font-mono">Alberta Grade 4 Curriculum</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 bg-[#141414]/5 p-1 rounded-full mr-4">
            <button 
              onClick={() => setViewMode('teacher')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-mono transition-all ${viewMode === 'teacher' ? 'bg-[#141414] text-[#E4E3E0]' : 'hover:bg-[#141414]/10'}`}
            >
              <GraduationCap size={14} />
              TEACHER
            </button>
            <button 
              onClick={() => setViewMode('student')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-mono transition-all ${viewMode === 'student' ? 'bg-[#141414] text-[#E4E3E0]' : 'hover:bg-[#141414]/10'}`}
            >
              <Gamepad2 size={14} />
              STUDENT
            </button>
          </div>

          {viewMode === 'teacher' && (
            <nav className="hidden md:flex items-center gap-1 bg-[#141414]/5 p-1 rounded-full">
              <button 
                onClick={() => setActiveTab('studio')}
                className={`px-4 py-1.5 rounded-full text-xs font-mono transition-all ${activeTab === 'studio' ? 'bg-[#141414] text-[#E4E3E0]' : 'hover:bg-[#141414]/10'}`}
              >
                STUDIO
              </button>
              <button 
                onClick={() => setActiveTab('characters')}
                className={`px-4 py-1.5 rounded-full text-xs font-mono transition-all ${activeTab === 'characters' ? 'bg-[#141414] text-[#E4E3E0]' : 'hover:bg-[#141414]/10'}`}
              >
                CHARACTERS
              </button>
              <button 
                onClick={() => setActiveTab('help')}
                className={`px-4 py-1.5 rounded-full text-xs font-mono transition-all ${activeTab === 'help' ? 'bg-[#141414] text-[#E4E3E0]' : 'hover:bg-[#141414]/10'}`}
              >
                QUICK HELP
              </button>
            </nav>
          )}
          {isActive && (
            <div className="flex items-center gap-2 px-3 py-1 bg-[#141414] text-[#E4E3E0] rounded-full text-xs font-mono">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              LIVE STUDIO
            </div>
          )}
          
          {user ? (
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-[10px] font-mono opacity-50 uppercase leading-none">Mastered</p>
                <p className="text-sm font-bold leading-none">{masteredOutcomes.length} Skills</p>
              </div>
              <button 
                onClick={logOut}
                className="w-10 h-10 rounded-full overflow-hidden border-2 border-[#141414] hover:scale-105 transition-all"
                title="Sign Out"
              >
                <img src={user.photoURL || ""} alt={user.displayName || ""} referrerPolicy="no-referrer" />
              </button>
            </div>
          ) : (
            <button 
              onClick={signInWithGoogle}
              className="flex items-center gap-2 px-4 py-2 bg-[#141414] text-[#E4E3E0] rounded-full text-xs font-bold hover:scale-105 transition-all"
            >
              <User size={16} />
              SIGN IN
            </button>
          )}
        </div>
      </header>

      <main className={`flex-1 overflow-hidden ${viewMode === 'teacher' ? "max-w-7xl mx-auto p-8 w-full overflow-y-auto" : "w-full"}`}>
        <FirestoreErrorBoundary>
          {viewMode === 'teacher' ? (
            <div className="space-y-8">
              <section className="bg-white border-2 border-[#141414] p-8 rounded-3xl shadow-[8px_8px_0px_0px_rgba(20,20,20,1)]">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-blue-500 text-white rounded-2xl">
                    <GraduationCap size={32} />
                  </div>
                  <div>
                    <h2 className="font-serif italic text-4xl">Teacher Dashboard</h2>
                    <p className="opacity-50 font-mono text-xs uppercase tracking-widest">Guide the Learning Journey</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <label className="block text-sm font-bold uppercase tracking-wider opacity-70">Set Learning Goal</label>
                    <div className="flex flex-col gap-4">
                      <div className="flex gap-2">
                        <select 
                          className="bg-[#F5F5F3] border-2 border-[#141414] rounded-2xl px-4 py-4 focus:outline-none focus:ring-4 focus:ring-blue-500/20 text-sm font-bold"
                          onChange={(e) => setTeacherConceptInput(e.target.value)}
                          value=""
                        >
                          <option value="" disabled>Select a Topic...</option>
                          {CONCEPTS.map(concept => (
                            <option key={concept.id} value={concept.id.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}>
                              {concept.id.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                            </option>
                          ))}
                        </select>
                        <div className="flex-1 flex gap-2">
                          <input 
                            type="text"
                            value={teacherConceptInput}
                            onChange={(e) => setTeacherConceptInput(e.target.value)}
                            placeholder="or type custom goal..."
                            className="flex-1 bg-[#F5F5F3] border-2 border-[#141414] rounded-2xl px-6 py-4 focus:outline-none focus:ring-4 focus:ring-blue-500/20"
                          />
                          <button 
                            onClick={setConceptAsTeacher}
                            disabled={!isActive || !teacherConceptInput.trim()}
                            className="px-8 bg-[#141414] text-white rounded-2xl font-bold hover:scale-105 active:scale-95 transition-all disabled:opacity-30 flex items-center gap-2"
                          >
                            Set <ChevronRight size={20} />
                          </button>
                        </div>
                      </div>
                    </div>
                    <p className="text-xs opacity-50 italic">This will instruct the AI Host to focus the next story on this concept.</p>
                  </div>

                  <div className="bg-blue-50 p-6 rounded-2xl border-2 border-blue-100">
                    <h4 className="font-bold mb-2 flex items-center gap-2">
                      <Sparkles size={16} className="text-blue-500" />
                      Teacher Tips
                    </h4>
                    <ul className="text-sm space-y-2 opacity-80 list-disc pl-4">
                      <li>Use the "Quick Help" tab to check curriculum details.</li>
                      <li>Toggle to "Student View" to see the immersive story.</li>
                      <li>The Agent Control Room shows the AI's reasoning process.</li>
                    </ul>
                  </div>
                </div>
              </section>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Agent Control Room Column */}
                <div className="lg:col-span-4 space-y-6">
                  <div className="bg-[#141414] border-2 border-[#141414] rounded-3xl p-6 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] overflow-hidden">
                    <div className="flex items-center justify-between mb-6">
                      <span className="text-[11px] font-mono text-[#E4E3E0] uppercase tracking-widest flex items-center gap-2">
                        <Layout size={16} />
                        Agent Control Room
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-3">
                      {agents.map((agent, i) => (
                        <motion.div 
                          key={`${agent.role}-${i}`}
                          animate={{ 
                            opacity: activeAgentRole === agent.role ? 1 : 0.4,
                            scale: activeAgentRole === agent.role ? 1 : 0.98
                          }}
                          className={`p-3 rounded-2xl border transition-all duration-300 ${activeAgentRole === agent.role ? 'bg-white/10 border-white/20 shadow-inner' : 'bg-transparent border-transparent'}`}
                        >
                          <div className="flex justify-between items-center mb-1.5">
                            <span className="text-[10px] font-bold text-[#E4E3E0] tracking-tight">{agent.name}</span>
                            <div className={`w-1.5 h-1.5 rounded-full ${
                              agent.status === 'idle' ? 'bg-white/20' :
                              agent.status === 'thinking' ? 'bg-blue-400 animate-pulse' :
                              agent.status === 'acting' ? 'bg-emerald-400 animate-pulse' :
                              'bg-purple-400 animate-pulse'
                            }`} />
                          </div>
                          <span className={`text-[8px] px-2 py-0.5 rounded-full uppercase font-mono tracking-tighter ${
                            agent.status === 'idle' ? 'bg-white/5 text-white/30' :
                            agent.status === 'thinking' ? 'bg-blue-500/20 text-blue-400' :
                            agent.status === 'acting' ? 'bg-emerald-500/20 text-emerald-400' :
                            'bg-purple-500/20 text-purple-400'
                          }`}>
                            {agent.status}
                          </span>
                          {agent.lastAction && activeAgentRole === agent.role && (
                            <motion.p 
                              initial={{ opacity: 0, y: 5 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="text-[9px] text-[#E4E3E0]/50 italic mt-2 leading-tight"
                            >
                              {agent.lastAction}
                            </motion.p>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white border-2 border-[#141414] rounded-3xl p-6 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
                    <h4 className="font-bold mb-4 uppercase tracking-widest text-xs opacity-50">Mastery Progress</h4>
                    <div className="space-y-3">
                      {masteredOutcomes.length === 0 ? (
                        <p className="text-sm opacity-50 italic">No outcomes mastered yet.</p>
                      ) : (
                        masteredOutcomes.map((code, i) => (
                          <div key={`${code}-${i}`} className="flex items-center gap-2 text-sm bg-emerald-50 text-emerald-700 p-2 rounded-xl border border-emerald-100">
                            <Star size={14} fill="currentColor" />
                            <span className="font-bold">{code}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Interaction Log Column */}
                <div className="lg:col-span-8">
                  <div className="bg-white border-2 border-[#141414] rounded-3xl overflow-hidden flex flex-col shadow-[8px_8px_0px_0px_rgba(20,20,20,1)] h-[600px]">
                    <div className="p-4 border-b-2 border-[#141414] bg-[#141414] text-[#E4E3E0] flex justify-between items-center">
                      <span className="text-[11px] font-mono uppercase tracking-widest flex items-center gap-2">
                        <MessageCircle size={16} />
                        Full Interaction Log
                      </span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 space-y-4 font-mono text-sm bg-[#F5F5F3]">
                      {transcript.map((line, i) => (
                        <div key={i} className={`p-4 rounded-2xl ${line.startsWith('AI:') ? 'bg-white border border-gray-200' : line.startsWith('Teacher:') ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}>
                          <span className="font-bold block mb-1 text-[10px] opacity-50">
                            {line.startsWith('AI:') ? 'HOST' : line.startsWith('Teacher:') ? 'TEACHER' : 'STUDENT'}
                          </span>
                          {line.replace(/^(AI:|You:|Teacher:)\s*/, '')}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className={`w-full h-full flex flex-col relative overflow-hidden transition-colors duration-1000 ${storyContext.isStoryStarted ? 'storybook-bg' : 'bg-[#141414]'}`}>
              {/* Main Visual Studio */}
              <div className="flex-1 relative">
                {/* Immersive Background */}
                {!storyContext.isStoryStarted && (
                  <div className="absolute inset-0">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,#2a2a2a_0%,#141414_100%)]" />
                    <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]" />
                  </div>
                )}

                {/* Content Overlay */}
                <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center">
                  <AnimatePresence mode="wait">
                    {!isActive ? (
                      <motion.div
                        key="start"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.1 }}
                        className="space-y-8"
                      >
                        <div className="relative mb-12">
                          <motion.div 
                            animate={{ 
                              y: [0, -10, 0],
                              rotate: [0, 2, 0, -2, 0]
                            }}
                            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                            className="relative z-10"
                          >
                            <div className="w-48 h-48 bg-amber-500/20 rounded-full mx-auto p-2 backdrop-blur-xl border-4 border-amber-500/30 shadow-[0_0_50px_rgba(245,158,11,0.3)] overflow-hidden">
                              <img 
                                src="https://picsum.photos/seed/cappy-guide-sticker-v2/512/512" 
                                alt="Cappy the Capybara"
                                className="w-full h-full object-cover rounded-full border-4 border-white shadow-lg"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                          </motion.div>
                          <motion.div 
                            animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                            transition={{ duration: 4, repeat: Infinity }}
                            className="absolute inset-0 bg-amber-500/20 blur-3xl rounded-full -z-10"
                          />
                        </div>
                        <div className="space-y-4">
                          <h2 className={`text-6xl ${storyContext.isStoryStarted ? 'storybook-text italic font-bold' : 'font-serif italic text-[#E4E3E0]'}`}>
                            {storyContext.isStoryStarted ? 'The Adventure Begins...' : "I'm Cappy!"}
                          </h2>
                          <p className={`${storyContext.isStoryStarted ? 'storybook-text text-xl' : 'text-[#E4E3E0] opacity-70 max-w-md mx-auto text-lg'}`}>
                            {storyContext.isStoryStarted 
                              ? `Our quest in the ${storyContext.setting} with ${storyContext.sidekick} is unfolding!`
                              : "Your ultra-chill capybara guide to math adventures. Ready to turn numbers into an epic story?"}
                          </p>
                        </div>
                        <button
                          onClick={startSession}
                          disabled={isConnecting}
                          className="group relative px-12 py-5 bg-[#E4E3E0] text-[#141414] rounded-full font-bold text-xl overflow-hidden transition-all hover:scale-105 active:scale-95 disabled:opacity-50 shadow-[0_10px_20px_rgba(0,0,0,0.3)]"
                        >
                          <span className="relative z-10 flex items-center gap-3">
                            {isConnecting ? <RefreshCw className="animate-spin" /> : <Play fill="currentColor" />}
                            {isConnecting ? 'Waking up the host...' : 'Enter the Studio'}
                          </span>
                        </button>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="active"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className={`w-full h-full flex flex-col relative ${storyContext.isStoryStarted ? 'p-12' : ''}`}
                      >
                        {storyContext.isStoryStarted && (
                          <div className="absolute inset-4 border-8 border-[#8b5e3c] rounded-3xl pointer-events-none z-10 shadow-[inset_0_0_50px_rgba(0,0,0,0.2)]" />
                        )}

                        {/* Live Story Background */}
                        {storyContext.isStoryStarted && currentArtifact?.artifact.imageUrl && (
                          <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 0.4 }}
                            className="absolute inset-0 z-0 overflow-hidden"
                          >
                            <motion.img 
                              src={currentArtifact.artifact.imageUrl}
                              alt="Background"
                              className="w-full h-full object-cover blur-[2px] scale-110"
                              animate={{ 
                                scale: [1.1, 1.2, 1.1],
                                rotate: [0, 0.5, 0, -0.5, 0],
                                x: [-10, 10, -10],
                                y: [-10, 10, -10]
                              }}
                              transition={{ 
                                duration: 30, 
                                repeat: Infinity, 
                                ease: "easeInOut" 
                              }}
                              referrerPolicy="no-referrer"
                            />
                            {/* Floating Particles Effect */}
                            <div className="absolute inset-0 pointer-events-none">
                              {[...Array(20)].map((_, i) => (
                                <motion.div
                                  key={i}
                                  className="absolute w-1 h-1 bg-white/40 rounded-full"
                                  initial={{ 
                                    x: Math.random() * 100 + "%", 
                                    y: Math.random() * 100 + "%",
                                    opacity: 0 
                                  }}
                                  animate={{ 
                                    y: [null, "-100%"],
                                    opacity: [0, 1, 0]
                                  }}
                                  transition={{ 
                                    duration: Math.random() * 10 + 10, 
                                    repeat: Infinity, 
                                    delay: Math.random() * 10 
                                  }}
                                />
                              ))}
                            </div>
                            <div className="absolute inset-0 bg-gradient-to-b from-[#f4ecd8]/90 via-transparent to-[#f4ecd8]/90" />
                          </motion.div>
                        )}
                        
                        {/* Story Progress Header */}
                        <div className="absolute top-0 left-0 right-0 p-8 z-20 flex justify-between items-center pointer-events-none">
                          <div className="flex gap-4 pointer-events-auto">
                            {storyContext.setting && (
                              <motion.div 
                                initial={{ x: -20, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                className="bg-white/10 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/20 flex items-center gap-3"
                              >
                                <Layout size={20} className="text-blue-400" />
                                <div className="text-left">
                                  <p className="text-[10px] uppercase tracking-widest text-white/50 font-bold">Setting</p>
                                  <p className="text-sm font-bold text-white">{storyContext.setting}</p>
                                </div>
                              </motion.div>
                            )}
                            {storyContext.sidekick && (
                              <motion.div 
                                initial={{ x: -20, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                transition={{ delay: 0.1 }}
                                className="bg-white/10 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/20 flex items-center gap-3"
                              >
                                <User size={20} className="text-purple-400" />
                                <div className="text-left">
                                  <p className="text-[10px] uppercase tracking-widest text-white/50 font-bold">Sidekick</p>
                                  <p className="text-sm font-bold text-white">{storyContext.sidekick}</p>
                                </div>
                              </motion.div>
                            )}
                          </div>
                          
                          <div className="flex gap-4 pointer-events-auto">
                            {soundtrackMood !== 'none' && (
                              <motion.div 
                                initial={{ x: 20, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                className="bg-emerald-500/20 backdrop-blur-md px-6 py-3 rounded-2xl border border-emerald-500/30 flex items-center gap-3 animate-pulse"
                              >
                                <Volume2 size={20} className="text-emerald-400" />
                                <div className="text-left">
                                  <p className="text-[10px] uppercase tracking-widest text-emerald-400/50 font-bold">Soundtrack</p>
                                  <p className="text-sm font-bold text-emerald-400">{soundtrackMood}</p>
                                </div>
                              </motion.div>
                            )}
                            {storyContext.isStoryStarted && (
                              <motion.div 
                                initial={{ y: -20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                className="bg-amber-500 px-6 py-3 rounded-2xl border-4 border-amber-600 flex items-center gap-3 shadow-lg"
                              >
                                <Sparkles size={20} className="text-white" />
                                <div className="text-left">
                                  <p className="text-[10px] uppercase tracking-widest text-amber-100 font-bold">Current Phase</p>
                                  <p className="text-sm font-black text-white italic">STORY MODE</p>
                                </div>
                              </motion.div>
                            )}
                          </div>
                        </div>

                        {/* Top Bar */}
                        <div className="flex justify-between items-start w-full mb-8">
                          <div className="text-left bg-black/40 backdrop-blur-md p-4 rounded-2xl border border-white/10 flex items-center gap-4">
                            <div>
                              <span className="text-[10px] font-mono text-[#E4E3E0] opacity-50 uppercase tracking-[0.2em] block mb-1">Active Concept</span>
                              <h3 className="text-[#E4E3E0] font-serif italic text-2xl">
                                {currentMathIdea || "Analyzing your request..."}
                              </h3>
                            </div>
                            {currentMathIdea && (
                              <button 
                                onClick={narrateMathIdea}
                                disabled={isGeneratingSpeech}
                                className="p-3 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-all"
                                title="Narrate this idea"
                              >
                                {isGeneratingSpeech ? <RefreshCw size={20} className="animate-spin" /> : <Volume2 size={20} />}
                              </button>
                            )}
                          </div>
                          
                          <div className="flex gap-3">
                            <button 
                              onClick={() => setShowGuide(true)}
                              className="p-4 bg-white/10 text-white rounded-2xl hover:bg-white/20 transition-all border border-white/20 flex items-center gap-2"
                              title="How to play"
                            >
                              <HelpCircle size={24} />
                              <span className="text-xs font-mono uppercase tracking-widest hidden md:block">Guide</span>
                            </button>
                            <button 
                              onClick={toggleCamera}
                              className={`p-4 rounded-2xl transition-all ${showCamera ? 'bg-blue-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
                            >
                              <Camera size={24} />
                            </button>
                            <button 
                              onClick={stopSession}
                              className="p-4 bg-red-500/20 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all border border-red-500/30"
                            >
                              <X size={24} />
                            </button>
                          </div>
                        </div>

                        {/* Main Visual Area */}
                        <div className="flex-1 flex items-center justify-center relative">
                          {/* Camera Preview */}
                          {showCamera && (
                            <motion.div 
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className="absolute top-4 right-4 w-64 aspect-video bg-black rounded-xl overflow-hidden border-2 border-white/20 shadow-xl z-20"
                            >
                              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                              <canvas ref={canvasRef} width={320} height={240} className="hidden" />
                              
                              {/* Vision Status Overlay */}
                              <div className="absolute inset-0 bg-blue-500/10 pointer-events-none">
                                <div className="absolute top-2 left-2 flex items-center gap-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded-md border border-white/10">
                                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                                  <span className="text-[8px] font-mono text-white uppercase tracking-widest">Vision Active</span>
                                </div>
                                
                                {/* Scanning Line Animation */}
                                <motion.div 
                                  animate={{ top: ['0%', '100%', '0%'] }}
                                  transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                                  className="absolute left-0 right-0 h-[1px] bg-blue-500/50 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                                />
                              </div>
                            </motion.div>
                          )}

                          {/* Persistent Cappy Guide Avatar */}
                          <motion.div 
                            initial={{ x: 100, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            className="absolute bottom-8 right-8 z-30 flex flex-col items-end gap-2 pointer-events-auto"
                          >
                            <div className="bg-white/90 backdrop-blur-md p-2 rounded-2xl border-2 border-amber-500 shadow-xl flex items-center gap-3">
                              <div className="w-16 h-16 rounded-xl overflow-hidden border-2 border-amber-200 bg-amber-50">
                                <img 
                                  src="https://picsum.photos/seed/cappy-guide-sticker-v2/200/200" 
                                  alt="Cappy Guide"
                                  className="w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                              <div className="pr-4">
                                <p className="text-[10px] font-black text-amber-600 uppercase tracking-tighter">Your Guide</p>
                                <p className="text-lg font-serif italic text-[#5d4037] leading-none">Cappy</p>
                              </div>
                            </div>
                            <motion.div 
                              animate={{ y: [0, -5, 0] }}
                              transition={{ duration: 2, repeat: Infinity }}
                              className="bg-amber-500 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-md"
                            >
                              Ready for Adventure!
                            </motion.div>
                          </motion.div>

                          {/* Artifact Display */}
                          <AnimatePresence mode="wait">
                            {currentArtifact ? (
                              <motion.div
                                key={currentArtifact.artifact.id}
                                initial={{ opacity: 0, y: 50, scale: 0.9 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, scale: 1.1 }}
                                className={`${storyContext.isStoryStarted ? 'bg-[#fdfbf7] p-6 border-[12px] border-[#5d4037] shadow-[0_30px_60px_rgba(0,0,0,0.4)]' : 'bg-white/95 backdrop-blur-md p-8 border-4 border-blue-500'} rounded-3xl max-w-2xl z-10`}
                              >
                                <div className="flex flex-col items-center gap-6">
                                  {currentArtifact.artifact.imageUrl ? (
                                    <motion.div 
                                      className={`w-full aspect-video overflow-hidden ${storyContext.isStoryStarted ? 'rounded-none border-4 border-[#5d4037]/20 shadow-inner' : 'rounded-2xl border-4 border-white shadow-lg'}`}
                                      animate={storyContext.isStoryStarted ? {
                                        scale: [1, 1.03, 1],
                                        filter: ["brightness(1)", "brightness(1.05)", "brightness(1)"]
                                      } : {}}
                                      transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                                    >
                                      <img 
                                        src={currentArtifact.artifact.imageUrl} 
                                        alt={currentArtifact.artifact.description} 
                                        className="w-full h-full object-cover"
                                        referrerPolicy="no-referrer"
                                      />
                                    </motion.div>
                                  ) : (
                                    <div className={`w-24 h-24 ${storyContext.isStoryStarted ? 'bg-[#5d4037]/10 text-[#5d4037]' : 'bg-blue-100 text-blue-600'} rounded-full flex items-center justify-center`}>
                                      <Layout size={48} />
                                    </div>
                                  )}
                                  <div className="text-center space-y-2">
                                    <h4 className={`text-2xl font-bold ${storyContext.isStoryStarted ? 'storybook-text text-[#5d4037]' : 'text-[#141414]'}`}>{currentArtifact.artifact.description}</h4>
                                    {currentArtifact.message && (
                                      <p className={`text-lg italic ${storyContext.isStoryStarted ? 'storybook-text text-[#5d4037]/80' : 'text-[#141414]/70'}`}>"{currentArtifact.message}"</p>
                                    )}
                                  </div>
                                  <button 
                                    onClick={() => setCurrentArtifact(null)}
                                    className={`px-8 py-3 ${storyContext.isStoryStarted ? 'bg-[#5d4037] text-[#fdfbf7] font-serif italic' : 'bg-[#141414] text-white font-bold'} rounded-full text-lg shadow-md hover:scale-105 transition-all`}
                                  >
                                    Continue the Quest
                                  </button>
                                </div>
                              </motion.div>
                            ) : (
                              <motion.div 
                                key="host-avatar"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                className="flex flex-col items-center gap-8"
                              >
                                {/* Animated Host Avatar */}
                                <motion.div
                                  animate={{ 
                                    y: [0, -20, 0],
                                    scale: [1, 1.05, 1]
                                  }}
                                  transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                                  className="w-48 h-48 bg-[#E4E3E0] rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(228,227,224,0.3)]"
                                >
                                  <Sparkles size={80} className="text-[#141414]" />
                                </motion.div>
                                
                                {/* Audio Visualizer */}
                                <div className="flex items-center gap-1.5 h-12">
                                  {Array.from({ length: 15 }).map((_, i) => (
                                    <motion.div
                                      key={i}
                                      animate={{
                                        height: isRecording ? [10, Math.random() * 40 + 10, 10] : 4,
                                      }}
                                      transition={{
                                        repeat: Infinity,
                                        duration: 0.4 + Math.random() * 0.4,
                                      }}
                                      className="w-1.5 bg-[#E4E3E0] rounded-full opacity-40"
                                    />
                                  ))}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        {/* Interactive Choices */}
                        <AnimatePresence>
                          {currentChoices.length > 0 && (
                            <motion.div 
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 10 }}
                              className="flex flex-wrap justify-center gap-3 mb-6"
                            >
                              {currentChoices.map((choice, i) => (
                                <button
                                  key={i}
                                  onClick={() => selectChoice(choice)}
                                  className="px-6 py-2 bg-white/10 backdrop-blur-md border border-white/20 text-white rounded-full hover:bg-white/20 transition-all text-sm font-bold shadow-lg hover:scale-105 active:scale-95"
                                >
                                  {choice}
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* Text Input Area */}
                        <div className="w-full max-w-3xl mx-auto mb-8 relative px-4">
                          <div className="flex flex-col md:flex-row gap-3">
                            <div className="relative group">
                              <select 
                                className="h-full bg-black/60 backdrop-blur-xl text-white px-6 py-3 rounded-full border border-white/20 focus:outline-none appearance-none pr-10 cursor-pointer hover:bg-black/80 transition-all font-bold text-sm"
                                onChange={(e) => {
                                  setStudioTextInput(e.target.value);
                                  // Optionally auto-send if it's a topic selection
                                }}
                                value=""
                              >
                                <option value="" disabled>Pick a Topic...</option>
                                {CONCEPTS.map(concept => (
                                  <option key={concept.id} value={`I want to learn about ${concept.id.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}`}>
                                    {concept.id.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                                  </option>
                                ))}
                              </select>
                              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-white/50">
                                <HelpCircle size={16} />
                              </div>
                            </div>

                            <div className="flex-1 bg-black/40 backdrop-blur-xl p-2 rounded-full border border-white/20 flex items-center gap-2 shadow-2xl">
                              <input 
                                type="text"
                                value={studioTextInput}
                                onChange={(e) => setStudioTextInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && sendStudioText()}
                                placeholder="Type a message to the Math Host..."
                                className="flex-1 bg-transparent text-white px-6 py-3 focus:outline-none placeholder:text-white/30"
                              />
                              <button 
                                onClick={sendStudioText}
                                disabled={!studioTextInput.trim()}
                                className="w-12 h-12 bg-white text-[#141414] rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all disabled:opacity-30"
                              >
                                <Send size={20} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          )}

          {viewMode === 'teacher' && activeTab === 'characters' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {DIGIT_CHARACTERS.map((char, i) => (
                <motion.div 
                  key={`${char.digit}-${i}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white border-2 border-[#141414] p-6 rounded-3xl shadow-[6px_6px_0px_0px_rgba(20,20,20,1)] flex flex-col gap-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-[#141414] text-[#E4E3E0] rounded-2xl flex items-center justify-center text-4xl font-serif italic">
                      {char.digit}
                    </div>
                    <div>
                      <h4 className="text-xl font-bold">{char.name}</h4>
                      <p className="text-xs font-mono uppercase opacity-50">{char.trait}</p>
                    </div>
                  </div>
                  <p className="text-sm opacity-70 italic">"{char.personality}"</p>
                  <div className="bg-[#141414]/5 p-3 rounded-xl text-xs font-mono">
                    <strong>Math Rule:</strong> {char.mathRule}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {char.numericProperties.isPrime && <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-md text-[10px] font-bold">PRIME</span>}
                    {char.numericProperties.isEven ? <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-md text-[10px] font-bold">EVEN</span> : <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-md text-[10px] font-bold">ODD</span>}
                    {char.numericProperties.isSquare && <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-md text-[10px] font-bold">SQUARE</span>}
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {viewMode === 'teacher' && activeTab === 'help' && (
            <div className="bg-white border-2 border-[#141414] p-8 rounded-3xl shadow-[8px_8px_0px_0px_rgba(20,20,20,1)] space-y-6">
              <div className="space-y-2">
                <h3 className="text-3xl font-serif italic">Quick Math Help</h3>
                <p className="opacity-60">Need a fast answer? Ask me anything about math!</p>
              </div>
              
              <div className="flex gap-3">
                <input 
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="e.g., What is a prime number?"
                  className="flex-1 bg-[#F5F5F3] border-2 border-[#141414] rounded-2xl px-6 py-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button 
                  onClick={handleQuickHelp}
                  className="px-8 bg-[#141414] text-white rounded-2xl font-bold hover:scale-105 transition-all"
                >
                  Ask
                </button>
              </div>

              {quickHelpResponse && (
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="p-6 bg-blue-50 border-l-4 border-blue-500 rounded-r-2xl"
                >
                  <p className="text-lg leading-relaxed">{quickHelpResponse}</p>
                </motion.div>
              )}
            </div>
          )}
          
          {/* Student View: Immersive Studio Only */}
          {isActive && (
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
              <div className={`w-2 h-2 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-500'}`} />
              <span className="text-[10px] font-mono text-white uppercase tracking-widest">
                {isRecording ? 'Host is Listening' : 'Mic Off'}
              </span>
            </div>
          )}

      {/* Curriculum Badge (Teacher Only) */}
      {viewMode === 'teacher' && (
        <div className="p-6 bg-emerald-50 border-2 border-emerald-500/20 rounded-3xl flex items-center gap-4 mt-8">
            <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-lg">
              <Star size={24} />
            </div>
            <div>
              <p className="text-[10px] font-mono text-emerald-600 uppercase tracking-widest font-bold">Alberta Certified</p>
              <p className="text-sm font-bold text-emerald-900">Grade 4 Math Mastery</p>
            </div>
          </div>
      )}
        </FirestoreErrorBoundary>
      </main>

      {/* Footer */}
      {viewMode === 'teacher' && (
        <footer className="max-w-7xl mx-auto p-8 border-t border-[#141414]/10 mt-12 flex justify-between text-[10px] font-mono opacity-40 uppercase tracking-[0.2em]">
          <span>Math Story Studio v2.0</span>
          <span>Immersive Visual Storytelling Mode</span>
          <span>Alberta Education Standards</span>
        </footer>
      )}
      {/* Host Guide Modal */}
      <AnimatePresence>
        {showGuide && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#141414]/90 backdrop-blur-md z-[100] flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-[#E4E3E0] text-[#141414] w-full max-w-2xl rounded-[40px] overflow-hidden shadow-2xl border-4 border-[#141414]"
            >
              <div className="p-12 space-y-8">
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <h2 className="text-5xl font-serif italic">Explorer's Guide</h2>
                    <p className="font-mono text-xs uppercase tracking-[0.3em] opacity-50">How to use the Math Story Studio</p>
                  </div>
                  <button 
                    onClick={() => setShowGuide(false)}
                    className="w-12 h-12 bg-[#141414] text-white rounded-full flex items-center justify-center hover:scale-110 transition-all"
                  >
                    <X size={24} />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="flex gap-4">
                      <div className="w-10 h-10 bg-[#141414] text-white rounded-xl flex items-center justify-center shrink-0">
                        <Mic size={20} />
                      </div>
                      <div>
                        <h4 className="font-bold">Voice Control</h4>
                        <p className="text-sm opacity-70">Talk to the host! Ask questions or tell your own stories.</p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="w-10 h-10 bg-[#141414] text-white rounded-xl flex items-center justify-center shrink-0">
                        <Send size={20} />
                      </div>
                      <div>
                        <h4 className="font-bold">Text Input</h4>
                        <p className="text-sm opacity-70">Type your messages if you prefer writing over talking.</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-6">
                    <div className="flex gap-4">
                      <div className="w-10 h-10 bg-[#141414] text-white rounded-xl flex items-center justify-center shrink-0">
                        <Camera size={20} />
                      </div>
                      <div>
                        <h4 className="font-bold">Vision Mode</h4>
                        <p className="text-sm opacity-70">Show the host your drawings or math problems on camera!</p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="w-10 h-10 bg-[#141414] text-white rounded-xl flex items-center justify-center shrink-0">
                        <Sparkles size={20} />
                      </div>
                      <div>
                        <h4 className="font-bold">The Goal</h4>
                        <p className="text-sm opacity-70">Explore Grade 4 Math concepts through magical adventures.</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-[#141414]/5 p-8 rounded-3xl border-2 border-[#141414]/10">
                  <h4 className="font-bold mb-4 flex items-center gap-2">
                    <Play size={16} />
                    Try saying...
                  </h4>
                  <ul className="space-y-3 text-lg italic font-serif">
                    <li>"Tell me a story about the number 7."</li>
                    <li>"How do I multiply 12 by 5 using an array?"</li>
                    <li>"What is a prime number, and where does it live?"</li>
                  </ul>
                </div>

                <button 
                  onClick={() => setShowGuide(false)}
                  className="w-full py-5 bg-[#141414] text-white rounded-full font-bold text-xl hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  Let's Go!
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
