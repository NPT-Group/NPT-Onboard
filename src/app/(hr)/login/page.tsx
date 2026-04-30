import LoginClient from "./LoginClient";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?:
    | Promise<{ callbackUrl?: string; errorMsg?: string }>
    | { callbackUrl?: string; errorMsg?: string };
}) {
  const sp = await Promise.resolve(searchParams); // works whether it's a Promise or plain object
  return <LoginClient callbackUrl={sp?.callbackUrl} errorMsg={sp?.errorMsg} />;
}
