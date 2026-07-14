import { useNavigate } from "react-router";
import { supabase } from "../../../lib/client";
import { Github, Search } from "lucide-react";
import { useEffect } from "react";
import { Logo } from "../Logo";

function GoogleIcon({ className = "w-5 h-5" }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
            />
            <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
            />
            <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                fill="#FBBC05"
            />
            <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                fill="#EA4335"
            />
        </svg>
    );
}

export default function Auth() {
    const navigate = useNavigate();

    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => {
            if (data.user) {
                navigate("/");
            }
        });
    }, [navigate]);

    async function handleGoogleSignIn() {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
                redirectTo: window.location.origin
            }
        });

        if (error) {
            alert("Error while signing in with Google");
        }
    }

    async function handleGithubSignIn() {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: "github",
            options: {
                redirectTo: window.location.origin
            }
        });

        if (error) {
            alert("Error while signing in with GitHub");
        }
    }

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-[#0B0D0E] text-slate-100 px-4 relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(24,188,148,0.08),transparent_50%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(56,189,248,0.05),transparent_50%)]" />

            <div className="w-full max-w-md bg-[#191C1E]/80 backdrop-blur-md border border-[#2D3135] rounded-2xl p-8 shadow-2xl relative z-10">
                <div className="flex flex-col items-center mb-8">
                    <div className="w-16 h-16 bg-gradient-to-br from-orange-500/10 to-emerald-500/10 rounded-2xl flex items-center justify-center border border-orange-500/20 mb-4 shadow-inner">
                        <Logo className="w-10 h-10" />
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight text-white mb-2 flex items-center gap-2">
                        IntelliSearch
                    </h1>
                    <p className="text-sm text-slate-400 text-center">
                        Where knowledge begins. Discover answers supported by web sources.
                    </p>
                </div>

                <div className="space-y-4">
                    <button
                        onClick={handleGoogleSignIn}
                        className="w-full py-3 px-4 bg-white hover:bg-slate-100 text-slate-900 font-semibold rounded-xl flex items-center justify-center gap-3 transition duration-200 shadow-sm cursor-pointer"
                    >
                        <GoogleIcon className="w-5 h-5" />
                        Continue with Google
                    </button>

                    <button
                        onClick={handleGithubSignIn}
                        className="w-full py-3 px-4 bg-[#24292F] hover:bg-[#2F363D] text-white font-semibold rounded-xl flex items-center justify-center gap-3 transition duration-200 border border-slate-700 cursor-pointer"
                    >
                        <Github className="w-5 h-5" />
                        Continue with GitHub
                    </button>
                </div>

                <div className="mt-8 text-center text-xs text-slate-500">
                    By signing in, you agree to our Terms of Service and Privacy Policy.
                </div>
            </div>
        </div>
    );
}