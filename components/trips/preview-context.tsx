"use client";
import { createContext } from "react";
import type { ActionState } from "@/lib/domain";
export const PreviewContext = createContext<{ perform: (operation: string, form: FormData) => Promise<ActionState> } | null>(null);
