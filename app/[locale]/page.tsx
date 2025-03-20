import { useTranslations } from 'next-intl';
import { Demo } from "@/components/demo";

export default function Home() {
  const t = useTranslations('common');

  return (
    <main className="min-h-screen p-6">
      <h1 className="text-3xl font-bold mb-4">{t('welcome')}</h1>
      <p className="mb-6">{t('description')}</p>
      <Demo />
    </main>
  );
}
