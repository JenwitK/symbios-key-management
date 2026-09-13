import { Badge } from "@/components/Badge/Badge";
import { Button } from "@/components/Button/Button";
import { CodeBlock } from "@/components/CodeBlock/CodeBlock";
import styles from "./Hero.module.css";

const LOADER_SNIPPET = `loadstring(game:HttpGet("https://raw.githubusercontent.com/SYMBIOSHUB/SYMBIOS-HUB/refs/heads/main/SYMBIOS.lua"))()`;

export function Hero() {
  return (
    <section className={styles.hero}>
      <div className={styles.copy}>
        <Badge tone="ok">Self-service panel</Badge>
        <h1 className={styles.headline}>
          Moved to a new device?
          <br />
          Reset your HWID.
        </h1>
        <p className={styles.subtitle}>
          Your key locks to one device the first time you run it. Switched
          PCs? Sign in with Discord, and clear the lock yourself in a few
          seconds. No waiting on staff.
        </p>
        <div className={styles.actions}>
          <Button href="/panel">Open panel</Button>
        </div>
      </div>

      <div className={styles.demo}>
        <CodeBlock filename="symbios-loader.lua" code={LOADER_SNIPPET} />
      </div>
    </section>
  );
}
