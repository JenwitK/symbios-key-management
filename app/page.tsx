import { Navbar } from "@/components/Navbar/Navbar";
import { Hero } from "@/components/Hero/Hero";
import { FeatureRow } from "@/components/FeatureRow/FeatureRow";
import { Footer } from "@/components/Footer/Footer";
import styles from "./page.module.css";

const STEPS = [
  {
    index: "01",
    title: "Open your panel",
    description:
      "Head to the panel and sign in with the Discord account you used when you got your key.",
  },
  {
    index: "02",
    title: "Link your key",
    description:
      "Paste your SYMBIOS-XXXX-XXXX-XXXX key into the link box and press Link key. It shows up in your keys list.",
  },
  {
    index: "03",
    title: "Press Reset HWID",
    description:
      "Find your key in the list and press Reset HWID to clear the device lock. Watch the Resets left count: each reset uses one.",
  },
  {
    index: "04",
    title: "Run on your new device",
    description:
      "Launch the loader on the device you want to use. Your key binds to it automatically on the first run.",
  },
] as const;

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <section className={styles.features}>
          <h2 className={styles.featuresTitle}>How to reset your HWID</h2>
          <div className={styles.featuresList}>
            {STEPS.map((step, i) => (
              <FeatureRow
                key={step.index}
                index={step.index}
                title={step.title}
                description={step.description}
                align={i % 2 === 0 ? "start" : "end"}
              />
            ))}
          </div>
          <p className={styles.note}>
            Reset HWID greyed out? Either no device is bound to that key yet,
            or you are out of resets. Ask in our{" "}
            <a
              href="https://discord.gg/RWbYvbyB2"
              target="_blank"
              rel="noopener noreferrer"
            >
              Discord
            </a>
            .
          </p>
        </section>
      </main>
      <Footer />
    </>
  );
}
