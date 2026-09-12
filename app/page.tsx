import { Navbar } from "@/components/Navbar/Navbar";
import { Hero } from "@/components/Hero/Hero";
import { FeatureRow } from "@/components/FeatureRow/FeatureRow";
import { Footer } from "@/components/Footer/Footer";
import styles from "./page.module.css";

const FEATURES = [
  {
    index: "01",
    title: "HWID-locked keys",
    description:
      "A key binds to one machine on first use. Swap hardware and the key stops working until an HWID reset clears the lock.",
  },
  {
    index: "02",
    title: "Server-side whitelist",
    description:
      "The obfuscated script never ships with the loader. It stays on our server and is only returned after the key and HWID pass validation.",
  },
  {
    index: "03",
    title: "Anti-bypass redeem",
    description:
      "Free keys route through a server-to-server check against the link provider — the redirect URL and client-side flags are never trusted.",
  },
  {
    index: "04",
    title: "Instant script updates",
    description:
      "Push a new build once in the dashboard. Every key holder gets it on their next loadstring — no re-download, no version drift.",
  },
] as const;

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <section className={styles.features}>
          <h2 className={styles.featuresTitle}>What gets enforced</h2>
          <div className={styles.featuresList}>
            {FEATURES.map((feature, i) => (
              <FeatureRow
                key={feature.index}
                index={feature.index}
                title={feature.title}
                description={feature.description}
                align={i % 2 === 0 ? "start" : "end"}
              />
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
