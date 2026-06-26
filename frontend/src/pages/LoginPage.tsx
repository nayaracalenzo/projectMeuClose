import { Button } from "../components/Button";
import { useNavigate } from "react-router-dom";
import { useState, type FormEvent } from "react";
import { Eye, EyeClosed } from "lucide-react";
import { postRequest } from "../services/request";

export default function LoginPage() {
  const [formData, setFormData] = useState({
    user: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMessage("");

    const username = formData.user.trim().toLowerCase();

    if (!username || !formData.password) {
      setErrorMessage("Informe usuário e senha.");
      return;
    }

    try {
      setLoading(true);
      const result = await postRequest("/auth/login", {
        username,
        password: formData.password,
      });
      localStorage.setItem("token", result.token);
      navigate("/home");
    } catch (_error) {
      setErrorMessage("Usuário ou senha incorretos");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative h-screen overflow-hidden bg-[url('/bg-soft.jpeg')] bg-cover bg-no-repeat bg-position-[center_20%] flex justify-center items-center px-4">
      <div className="absolute inset-0 bg-linear-to-br from-[#2a2324]/48 via-[#6b5b5e]/26 to-[#efe9e6]/40" />
      <div className="relative w-full max-w-140 rounded-xl border border-[#ffffff66] bg-[#F6F1EF]/88 p-8 shadow-2xl backdrop-blur-md md:p-12">
        <div className="mb-6 flex flex-col items-center">
          <div className="flex items-center justify-center gap-2">
            <img className="h-16 opacity-80" src="/manequim.png" alt="logo" />
            <h1 className="font-editorial text-[32px] uppercase tracking-[0.06em] text-[#161314]">
              Meu Close
            </h1>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-6">
          <div>
            <input
              className="h-12 w-full rounded-lg border border-[#a59797] bg-[#f9f7f6] px-3 text-xl text-[#2a2526] placeholder:text-[#8b8284] shadow-xs transition duration-200  focus:ring-2 focus:ring-[#8a4d5dcf] focus:outline-none"
              type="text"
              name="user"
              id="user"
              onChange={handleChange}
              placeholder="Digite seu usuário"
            />
          </div>

          <div className="relative">
            <input
              className="h-12 w-full rounded-lg border border-[#a59797] bg-[#f9f7f6] px-3 pr-10 text-xl text-[#2a2526] placeholder:text-[#8b8284] shadow-xs transition duration-200  focus:ring-2 focus:ring-[#8a4d5dcf] focus:outline-none"
              type={showPassword ? "text" : "password"}
              name="password"
              id="password"
              onChange={handleChange}
              placeholder="Digite sua senha"
            />
            <button
              type="button"
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute inset-y-0 right-2 flex items-center text-[#746d6f] hover:text-[#3c3436]"
            >
              {showPassword ? <Eye /> : <EyeClosed />}
            </button>
          </div>

          {errorMessage && (
            <p className="text-sm font-medium text-[#BA1A1A]">{errorMessage}</p>
          )}

          <Button
            type="submit"
            size="lg"
            className="mb-6"
            variant="tertiary"
            disabled={loading}
          >
            {loading ? "Entrando..." : "Entrar"}
          </Button>
        </form>
      </div>
    </main>
  );
}
