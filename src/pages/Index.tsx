import { useEffect, useRef, useState } from "react";
import { Flashlight, Zap, AlertTriangle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";

// SOS in Morse: ... --- ...
// Unit = base time. Dot = 1u, Dash = 3u, intra-letter gap = 1u,
// inter-letter gap = 3u, inter-word gap = 7u.
type SosStep = { on: boolean; units: number };
const SOS_PATTERN: SosStep[] = [
  // S = . . .
  { on: true, units: 1 }, { on: false, units: 1 },
  { on: true, units: 1 }, { on: false, units: 1 },
  { on: true, units: 1 },
  { on: false, units: 3 }, // letter gap
  // O = - - -
  { on: true, units: 3 }, { on: false, units: 1 },
  { on: true, units: 3 }, { on: false, units: 1 },
  { on: true, units: 3 },
  { on: false, units: 3 }, // letter gap
  // S = . . .
  { on: true, units: 1 }, { on: false, units: 1 },
  { on: true, units: 1 }, { on: false, units: 1 },
  { on: true, units: 1 },
  { on: false, units: 7 }, // word gap before repeat
];

const Index = () => {
  const [on, setOn] = useState(false);
  const [strobe, setStrobe] = useState(false);
  const [hz, setHz] = useState(8);
  const [strobeOn, setStrobeOn] = useState(true);
  const [sos, setSos] = useState(false);
  const [sosUnit, setSosUnit] = useState(200); // ms per unit
  const [sosOn, setSosOn] = useState(true);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<number | null>(null);
  const sosTimeoutRef = useRef<number | null>(null);
  const [hardwareTorch, setHardwareTorch] = useState(false);

  // Strobe and SOS are mutually exclusive
  useEffect(() => {
    if (sos && strobe) setStrobe(false);
  }, [sos, strobe]);

  // Acquire camera torch when turning on
  useEffect(() => {
    let cancelled = false;

    const enableTorch = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const track = stream.getVideoTracks()[0];
        trackRef.current = track;
        const caps = track.getCapabilities?.() as MediaTrackCapabilities & { torch?: boolean };
        if (caps && caps.torch) {
          await track.applyConstraints({ advanced: [{ torch: true } as MediaTrackConstraintSet] });
          setHardwareTorch(true);
        } else {
          setHardwareTorch(false);
        }
      } catch {
        setHardwareTorch(false);
      }
    };

    const disableTorch = async () => {
      try {
        if (trackRef.current) {
          const caps = trackRef.current.getCapabilities?.() as MediaTrackCapabilities & { torch?: boolean };
          if (caps?.torch) {
            await trackRef.current.applyConstraints({ advanced: [{ torch: false } as MediaTrackConstraintSet] });
          }
        }
      } catch {}
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      trackRef.current = null;
      setHardwareTorch(false);
    };

    if (on) {
      enableTorch();
    } else {
      disableTorch();
    }

    return () => {
      cancelled = true;
    };
  }, [on]);

  // Strobe loop — toggles screen flash and (if available) hardware torch
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setStrobeOn(true);

    if (on && strobe) {
      const period = Math.max(40, 1000 / hz / 2);
      intervalRef.current = window.setInterval(async () => {
        setStrobeOn((s) => {
          const next = !s;
          const track = trackRef.current;
          if (track && hardwareTorch) {
            try {
              track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
            } catch {}
          }
          return next;
        });
      }, period);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [on, strobe, hz, hardwareTorch]);

  // SOS loop — runs the Morse pattern on repeat
  useEffect(() => {
    const clearSos = () => {
      if (sosTimeoutRef.current) {
        clearTimeout(sosTimeoutRef.current);
        sosTimeoutRef.current = null;
      }
    };

    clearSos();
    setSosOn(true);

    if (!on || !sos) return;

    let stepIndex = 0;
    let cancelled = false;

    const runStep = () => {
      if (cancelled) return;
      const step = SOS_PATTERN[stepIndex];
      setSosOn(step.on);
      const track = trackRef.current;
      if (track && hardwareTorch) {
        try {
          track.applyConstraints({ advanced: [{ torch: step.on } as MediaTrackConstraintSet] });
        } catch {}
      }
      stepIndex = (stepIndex + 1) % SOS_PATTERN.length;
      sosTimeoutRef.current = window.setTimeout(runStep, step.units * sosUnit);
    };

    runStep();

    return () => {
      cancelled = true;
      clearSos();
    };
  }, [on, sos, sosUnit, hardwareTorch]);

  const lightActive =
    on && (sos ? sosOn : strobe ? strobeOn : true);

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-between overflow-hidden bg-background px-6 py-10">
      <header className="w-full text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Torch
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {sos && on
            ? "Sending SOS…"
            : hardwareTorch
            ? "Hardware flashlight active"
            : on
            ? "Screen light mode"
            : "Tap to turn on"}
        </p>
      </header>

      <button
        onClick={() => setOn((v) => !v)}
        aria-label={on ? "Turn flashlight off" : "Turn flashlight on"}
        className={`relative flex h-56 w-56 items-center justify-center rounded-full transition-all duration-150 active:scale-95 ${
          lightActive ? "torch-on" : "torch-off"
        }`}
      >
        <Flashlight
          className={`h-20 w-20 transition-colors ${
            lightActive ? "text-primary-foreground" : "text-muted-foreground"
          }`}
          strokeWidth={1.5}
        />
      </button>

      <section className="w-full max-w-sm space-y-6 rounded-3xl border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
              <Flashlight className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Flashlight</p>
              <p className="text-xs text-muted-foreground">Main light</p>
            </div>
          </div>
          <Switch checked={on} onCheckedChange={setOn} />
        </div>

        <div className="h-px w-full bg-border" />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Strobe</p>
              <p className="text-xs text-muted-foreground">Pulsing flash</p>
            </div>
          </div>
          <Switch
            checked={strobe}
            onCheckedChange={(v) => {
              setStrobe(v);
              if (v) setSos(false);
            }}
            disabled={!on}
          />
        </div>

        <div className={`space-y-3 ${strobe && on ? "opacity-100" : "opacity-40"}`}>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Speed</span>
            <span className="font-medium text-foreground">{hz.toFixed(1)} Hz</span>
          </div>
          <Slider
            value={[hz]}
            onValueChange={(v) => setHz(v[0])}
            min={1}
            max={20}
            step={0.5}
            disabled={!strobe || !on}
          />
        </div>

        <div className="h-px w-full bg-border" />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/15">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">SOS</p>
              <p className="text-xs text-muted-foreground">Morse distress signal</p>
            </div>
          </div>
          <Switch
            checked={sos}
            onCheckedChange={(v) => {
              setSos(v);
              if (v) setStrobe(false);
            }}
            disabled={!on}
          />
        </div>

        <div className={`space-y-3 ${sos && on ? "opacity-100" : "opacity-40"}`}>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Unit length</span>
            <span className="font-medium text-foreground">{sosUnit} ms</span>
          </div>
          <Slider
            value={[sosUnit]}
            onValueChange={(v) => setSosUnit(v[0])}
            min={80}
            max={400}
            step={20}
            disabled={!sos || !on}
          />
        </div>
      </section>

      <footer className="text-center text-xs text-muted-foreground">
        On Android the camera flash is used. In a browser without torch support, the screen lights up instead.
      </footer>
    </main>
  );
};

export default Index;
