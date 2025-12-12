import LoginClient from "./LoginClient";

export default function LoginPage({ searchParams }: { searchParams?: { errorMsg?: string } }) {
  return <LoginClient errorMsg={searchParams?.errorMsg} />;
}
