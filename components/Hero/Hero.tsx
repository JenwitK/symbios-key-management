import { Badge } from "@/components/Badge/Badge";
import { Button } from "@/components/Button/Button";
import { CodeBlock } from "@/components/CodeBlock/CodeBlock";
import styles from "./Hero.module.css";

const LOADER_SNIPPET = `loadstring(game:HttpGet("https://raw.githubusercontent.com/SYMBIOSHUB/SYMBIOS-HUB/refs/heads/main/SYMBIOS.lua"))()`;

export function Hero() {
  return (
    <section className={styles.hero}>
      <div className={styles.copy}>
        <Badge tone="ok">Whitelist online</Badge>
        <h1 className={styles.headline}>
          Key-based whitelist.
          <br />
          Nothing else runs.
        </h1>
        <p className={styles.subtitle}>
          Every script request hits our server first. No key, no HWID match,
          no code — the loader gets nothing back.
        </p>
        <div className={styles.actions}>
          <Button href="/panel">Manage key</Button>
        </div>
      </div>

      <div className={styles.demo}>
        <CodeBlock filename="symbios-loader.lua" code={LOADER_SNIPPET} />
      </div>
    </section>
  );
}
