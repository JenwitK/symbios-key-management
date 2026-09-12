"use client";

import { useActionState } from "react";
import { Button } from "@/components/Button/Button";
import { login, type LoginState } from "./actions";
import styles from "./login.module.css";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(login, initialState);

  return (
    <form action={formAction} className={styles.form}>
      <label className={styles.field}>
        <span className={styles.label}>Username</span>
        <input
          name="username"
          type="text"
          autoComplete="username"
          required
          className={styles.input}
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Password</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={styles.input}
        />
      </label>

      {state.error ? <p className={styles.error}>{state.error}</p> : null}

      <Button
        type="submit"
        disabled={isPending}
        className={styles.submit}
      >
        {isPending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
