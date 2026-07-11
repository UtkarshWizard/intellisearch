import { supabase } from "@/lib/client"
import type { User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";

export default function Conversation() {

    const [user, setUser] = useState<User | null>(null);
    const navigate = useNavigate()

    useEffect(() => {
        async function getInfo() {
            const { data, error } = await supabase.auth.getUser();

            if ( data.user) {
                setUser(data.user);
            }
        }
        getInfo()
    }, [])
    
    async function handleLogout() {
        await supabase.auth.signOut();
        navigate("/auth");
    }

    return <div>
        {user ? (
            <div>
                <p>Welcome, {user.email}</p>
                <button onClick={handleLogout}>Logout</button>
            </div>
        ) : (
            <button onClick={() => navigate("/auth")}>
                Sign In
            </button>
        )}
    </div>
}