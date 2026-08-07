"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

import type {
  AddressSuggestion,
  ResolvedAddress,
  SuggestScope,
} from "@/lib/places/types";
import { cn } from "./ui";

const DEBOUNCE_MS = 350;
const MIN_QUERY_LENGTH = 3;

/** Places session tokens are opaque; a UUID is what Google recommends. */
function newSessionToken() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * An address input with a suggestion dropdown.
 *
 * It stays a plain text input, not a select: Nominatim does not know every
 * address, and a customer whose building is missing from OpenStreetMap must
 * still be able to type it and submit. The dropdown is an accelerator, never
 * a gate.
 *
 * Implements the ARIA combobox pattern so it is usable from the keyboard and
 * announced correctly by screen readers.
 */
export function AddressAutocomplete({
  id,
  name,
  value,
  onValueChange,
  onSelect,
  scope = "address",
  fillWith = "component",
  placeholder,
  required,
  autoComplete = "off",
  invalid,
  className,
  maxLength,
}: {
  id: string;
  name: string;
  value: string;
  onValueChange: (value: string) => void;
  /** Fired once a pick is fully resolved, so sibling fields can be filled in. */
  onSelect?: (resolved: ResolvedAddress) => void;
  scope?: SuggestScope;
  /**
   * "component" fills only the part this field owns — the street line, the
   * city, the ZIP — because sibling inputs cover the rest. "full" fills the
   * whole one-line address, for the standalone inputs that have no siblings.
   */
  fillWith?: "component" | "full";
  placeholder?: string;
  required?: boolean;
  autoComplete?: string;
  invalid?: boolean;
  className?: string;
  maxLength?: number;
}) {
  const listId = `${useId()}-listbox`;
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [loading, setLoading] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  /**
   * Only a keystroke should trigger a lookup. Without this, filling city,
   * state, and ZIP from a chosen street address would make each of those
   * fields fetch their own suggestions and pop their own dropdown open — and
   * choosing an option in this field would immediately re-search for the text
   * it just inserted.
   */
  const userTyped = useRef(false);
  /**
   * Whether the input still has focus. The debounced lookup resolves ~350ms
   * after the last keystroke, by which time the customer may have tabbed on to
   * the next field — and a list that pops open over a field nobody is looking
   * at will happily cover the submit button.
   */
  const focused = useRef(false);
  /**
   * Groups this burst of keystrokes and the final details lookup into one
   * billable Places session. Google bills per session when a token is passed
   * and per keystroke when it is not, so this is the difference between cents
   * and dollars on a busy day. A new token starts after every completed
   * selection.
   */
  const sessionToken = useRef(newSessionToken());
  const [resolving, setResolving] = useState(false);
  /**
   * Bumped on every keystroke. The details lookup captures it and refuses to
   * write its answer if the number moved while the request was in flight —
   * otherwise a customer who picks a suggestion and immediately starts editing
   * gets their typing overwritten a second later by the address they just
   * abandoned.
   */
  const editEpoch = useRef(0);

  const closeList = useCallback(() => {
    setOpen(false);
    setActiveIndex(-1);
  }, []);

  function handleTyping(next: string) {
    userTyped.current = true;
    editEpoch.current += 1;
    onValueChange(next);

    // Clearing happens here rather than in the effect below: React forbids a
    // synchronous setState in an effect body, and an event handler is where
    // this belongs anyway.
    if (next.trim().length < MIN_QUERY_LENGTH) {
      abortRef.current?.abort();
      setSuggestions([]);
      setLoading(false);
      closeList();
    }
  }

  useEffect(() => {
    if (!userTyped.current) return;
    if (value.trim().length < MIN_QUERY_LENGTH) return;
    const query = value.trim();

    const timer = setTimeout(async () => {
      // Cancel the previous lookup so a slow earlier keystroke cannot land
      // after a faster later one and overwrite the list.
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);

      try {
        const response = await fetch(
          `/api/address/suggest?scope=${scope}&session=${sessionToken.current}` +
            `&q=${encodeURIComponent(query)}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error(String(response.status));
        const data = (await response.json()) as { suggestions: AddressSuggestion[] };

        setSuggestions(data.suggestions);
        setActiveIndex(-1);
        // Keep the results for when they come back, but only show them if
        // this field is still the one being used.
        setOpen(focused.current && data.suggestions.length > 0);
      } catch {
        // Aborted or upstream failure — leave the field alone and let the
        // user type the address out in full.
        if (!controller.signal.aborted) {
          setSuggestions([]);
          closeList();
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [value, scope, closeList]);

  // Abort any lookup still in flight when the field unmounts.
  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) closeList();
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [closeList]);

  /** What this particular field should display, given a resolved address. */
  function textFor(resolved: ResolvedAddress, fallback: string) {
    if (fillWith === "full") return resolved.formattedAddress || fallback;
    if (scope === "address") return resolved.addressLine1 || fallback;
    if (scope === "city") return resolved.city || fallback;
    if (scope === "state") return resolved.state || fallback;
    return resolved.postalCode || fallback;
  }

  async function choose(suggestion: AddressSuggestion) {
    userTyped.current = false;
    closeList();

    // Nominatim hands back the whole address with the prediction, so there is
    // nothing more to fetch. Google returns only a placeId and we buy the
    // details in a second call — made here, once, rather than per keystroke.
    if (suggestion.resolved) {
      applyResolved(suggestion.resolved, suggestion.primary);
      return;
    }

    if (!suggestion.placeId) {
      onValueChange(fillWith === "full" ? suggestion.label : suggestion.primary);
      return;
    }

    // Show the prediction text immediately so the field never looks empty
    // while the details request is in flight.
    onValueChange(fillWith === "full" ? suggestion.label : suggestion.primary);
    setResolving(true);
    const epoch = editEpoch.current;

    try {
      const response = await fetch(
        `/api/address/details?placeId=${encodeURIComponent(suggestion.placeId)}` +
          `&session=${sessionToken.current}`,
      );
      const data = (await response.json()) as { resolved: ResolvedAddress | null };
      // The user has typed since this was requested — their edit wins.
      if (data.resolved && epoch === editEpoch.current) {
        applyResolved(data.resolved, suggestion.primary);
      }
    } catch {
      // Leave the prediction text in place — it is still a usable address,
      // and the submit-time geocode will verify it properly.
    } finally {
      setResolving(false);
      // The session is spent whether or not the lookup succeeded.
      sessionToken.current = newSessionToken();
    }
  }

  function applyResolved(resolved: ResolvedAddress, fallback: string) {
    userTyped.current = false;
    onValueChange(textFor(resolved, fallback));
    onSelect?.(resolved);
    // Drop the predictions for the old query. Without this, clicking back
    // into a field that already holds a finished address reopens the previous
    // list, which reads as a stray dropdown appearing for no reason.
    setSuggestions([]);
    sessionToken.current = newSessionToken();
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) {
      if (event.key === "ArrowDown" && suggestions.length > 0) {
        event.preventDefault();
        setOpen(true);
        setActiveIndex(0);
      }
      return;
    }

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActiveIndex((index) => (index + 1) % suggestions.length);
        break;
      case "ArrowUp":
        event.preventDefault();
        setActiveIndex((index) =>
          index <= 0 ? suggestions.length - 1 : index - 1,
        );
        break;
      case "Enter":
        // Only intercept Enter when an option is actually highlighted;
        // otherwise let it submit the form as usual.
        if (activeIndex >= 0) {
          event.preventDefault();
          void choose(suggestions[activeIndex]);
        }
        break;
      case "Escape":
        event.preventDefault();
        closeList();
        break;
      case "Tab":
        closeList();
        break;
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        id={id}
        name={name}
        value={value}
        onChange={(event) => handleTyping(event.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => {
          focused.current = true;
          if (suggestions.length > 0) setOpen(true);
        }}
        // Leaving the field must close its list. Without this, tabbing from
        // the street line to the city leaves the street's dropdown hanging
        // over whatever is beneath it — including the submit button. Choosing
        // an option is safe: the option's onMouseDown preventDefaults, so no
        // blur fires before the click lands.
        onBlur={() => {
          focused.current = false;
          closeList();
        }}
        required={required}
        maxLength={maxLength}
        placeholder={placeholder}
        autoComplete={autoComplete}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined
        }
        aria-invalid={invalid || undefined}
        className={cn(
          "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none",
          "transition focus:border-brand focus:ring-2 focus:ring-brand/25",
          "disabled:cursor-not-allowed disabled:opacity-60",
          invalid && "border-red-500 focus:border-red-500 focus:ring-red-500/25",
          className,
        )}
      />

      {loading || resolving ? (
        <span
          aria-hidden
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted"
        >
          …
        </span>
      ) : null}

      <ul
        id={listId}
        role="listbox"
        hidden={!open || suggestions.length === 0}
        className={cn(
          "absolute z-20 mt-1 max-h-80 w-full overflow-y-auto rounded-lg",
          "border border-line bg-surface shadow-lg",
        )}
      >
        {suggestions.map((suggestion, index) => (
          <li
            key={suggestion.id}
            id={`${listId}-option-${index}`}
            role="option"
            aria-selected={index === activeIndex}
            // mousedown fires before the input's blur, so the click is not
            // swallowed by the dropdown closing first.
            onMouseDown={(event) => {
              event.preventDefault();
              void choose(suggestion);
            }}
            onMouseEnter={() => setActiveIndex(index)}
            className={cn(
              "cursor-pointer border-b border-line px-4 py-2.5 text-sm last:border-b-0",
              index === activeIndex ? "bg-brand/10" : "bg-transparent",
            )}
          >
            {suggestion.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
