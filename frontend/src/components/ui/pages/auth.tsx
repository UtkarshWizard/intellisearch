import { useNavigate } from "react-router";
import { supabase } from "../../../lib/client";

export default function Auth() {

    async function handleGoogleSignIn() {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: "google",
        });

        if (error) {
            alert("Error while sign in")
        }
    }

    async function handleGithubSignIn() {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: "github",
        });

        if (error) {
            alert("Error while sign in")
        }
    }   

    return (
        <div>
            <h1>Auth</h1>
            <button onClick={handleGoogleSignIn}>
                Login with goggle
            </button>
            <button onClick={handleGithubSignIn}>
                Login with github
            </button>
        </div>
    )
}