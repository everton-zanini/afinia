import type { Metadata } from "next";
import { PageHeader } from "@/components/app-shell/page-header";
import { requireUser } from "@/server/session";
import { InstallGuide } from "./install-guide";

export const metadata: Metadata = { title: "Instalar o app" };

export default async function InstallPage() {
  await requireUser();
  return (
    <>
      <PageHeader title="Instalar o app" backHref="/mais" description="Use o Afinia como um aplicativo, direto da tela inicial." />
      <InstallGuide />
    </>
  );
}
