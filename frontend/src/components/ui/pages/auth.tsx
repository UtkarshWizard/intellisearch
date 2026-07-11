import { useNavigate } from "react-router";
import { supabase } from "../../../lib/client";
import { Github, Chrome, Compass, Search } from "lucide-react";
import { useEffect } from "react";

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
                    <div className="w-12 h-12 bg-orange-500/10 rounded-xl flex items-center justify-center border border-orange-500/30 mb-4">
                        <Compass className="w-6 h-6 text-orange-400 animate-spin-slow" />
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
                        className="w-full py-3 px-4 bg-white hover:bg-slate-100 text-slate-900 font-semibold rounded-xl flex items-center justify-center gap-3 transition duration-200 shadow-sm"
                    >
                        <Chrome className="w-5 h-5 text-red-500" />
                        Continue with Google
                    </button>

                    <button
                        onClick={handleGithubSignIn}
                        className="w-full py-3 px-4 bg-[#24292F] hover:bg-[#2F363D] text-white font-semibold rounded-xl flex items-center justify-center gap-3 transition duration-200 border border-slate-700"
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