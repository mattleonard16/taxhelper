"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { 
  LayoutDashboard, 
  Receipt, 
  Inbox, 
  Lightbulb, 
  BadgeDollarSign,
  Settings,
  Plus,
  Search,
} from "lucide-react";

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  action: () => void;
  keywords?: string[];
}

interface CommandPaletteProps {
  onNewTransaction?: () => void;
}

export function CommandPalette({ onNewTransaction }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();

  const commands: CommandItem[] = [
    {
      id: "new-transaction",
      label: "New Transaction",
      description: "Create a new transaction",
      icon: <Plus className="h-4 w-4" />,
      action: () => {
        setOpen(false);
        onNewTransaction?.();
      },
      keywords: ["add", "create", "new"],
    },
    {
      id: "search-transactions",
      label: "Search Transactions",
      description: "Go to transactions and search",
      icon: <Search className="h-4 w-4" />,
      action: () => {
        setOpen(false);
        router.push("/transactions");
      },
      keywords: ["find", "filter"],
    },
    {
      id: "dashboard",
      label: "Dashboard",
      description: "Go to dashboard",
      icon: <LayoutDashboard className="h-4 w-4" />,
      action: () => {
        setOpen(false);
        router.push("/dashboard");
      },
      keywords: ["home", "overview"],
    },
    {
      id: "transactions",
      label: "Transactions",
      description: "View all transactions",
      icon: <Receipt className="h-4 w-4" />,
      action: () => {
        setOpen(false);
        router.push("/transactions");
      },
    },
    {
      id: "receipts",
      label: "Receipt Inbox",
      description: "Review pending receipts",
      icon: <Inbox className="h-4 w-4" />,
      action: () => {
        setOpen(false);
        router.push("/receipts");
      },
      keywords: ["review", "scan"],
    },
    {
      id: "insights",
      label: "Insights",
      description: "View AI insights",
      icon: <Lightbulb className="h-4 w-4" />,
      action: () => {
        setOpen(false);
        router.push("/insights");
      },
      keywords: ["ai", "analysis"],
    },
    {
      id: "deductions",
      label: "Deductions",
      description: "View potential deductions",
      icon: <BadgeDollarSign className="h-4 w-4" />,
      action: () => {
        setOpen(false);
        router.push("/deductions");
      },
      keywords: ["tax", "save"],
    },
    {
      id: "settings",
      label: "Settings",
      description: "App settings",
      icon: <Settings className="h-4 w-4" />,
      action: () => {
        setOpen(false);
        router.push("/settings");
      },
      keywords: ["preferences", "config"],
    },
  ];

  const filteredCommands = commands.filter((cmd) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      cmd.label.toLowerCase().includes(q) ||
      cmd.description?.toLowerCase().includes(q) ||
      cmd.keywords?.some((k) => k.includes(q))
    );
  });

  // Keyboard shortcut to open
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Navigate with arrow keys
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, filteredCommands.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && filteredCommands[selectedIndex]) {
      e.preventDefault();
      filteredCommands[selectedIndex].action();
    }
  }, [filteredCommands, selectedIndex]);

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      // Reset on close
      setQuery("");
      setSelectedIndex(0);
    }
  };

  const handleQueryChange = (newQuery: string) => {
    setQuery(newQuery);
    setSelectedIndex(0); // Reset selection when query changes
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden" data-testid="command-palette">
        <DialogHeader className="sr-only">
          <DialogTitle>Command Palette</DialogTitle>
        </DialogHeader>
        <div className="border-b p-3">
          <Input
            placeholder="Type a command or search..."
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onKeyDown={handleKeyDown}
            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            autoFocus
            data-testid="command-palette-input"
          />
        </div>
        <div className="max-h-[300px] overflow-y-auto p-2">
          {filteredCommands.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">
              No commands found
            </p>
          ) : (
            filteredCommands.map((cmd, index) => (
              <button
                key={cmd.id}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                  index === selectedIndex
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-muted"
                }`}
                onClick={cmd.action}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                  {cmd.icon}
                </span>
                <div>
                  <p className="text-sm font-medium">{cmd.label}</p>
                  {cmd.description && (
                    <p className="text-xs text-muted-foreground">{cmd.description}</p>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
        <div className="border-t px-3 py-2 text-xs text-muted-foreground">
          <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono">↑↓</kbd> navigate
          {" "}
          <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono">↵</kbd> select
          {" "}
          <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono">esc</kbd> close
        </div>
      </DialogContent>
    </Dialog>
  );
}
