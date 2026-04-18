import { useEffect, useRef, useState } from "react";
import { Flashlight, Zap } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";

const Index = () => {
  const [on, setOn] = useState(false);
  const [strobe, setStrobe] = useState(false);
  const [hz, setHz] = useState(8);
  const [strobeOn, setStrobeOn] = useState(true);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<number | null>(null);
  const [hardwareTorch, setHardwareTorch] = useState(false);

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

  const lightActive = on && (!strobe || strobeOn);

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-between overflow-hidden bg-background px-6 py-10">
      <header className="w-full text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Torch
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {hardwareTorch ? "Hardware flashlight active" : on ? "Screen light mode" : "Tap to turn on"}
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
          <Switch checked={strobe} onCheckedChange={setStrobe} disabled={!on} />
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
      </section>

      <footer className="text-center text-xs text-muted-foreground">
        On Android the camera flash is used. In a browser without torch support, the screen lights up instead.
      </footer>
    </main>
  );
};

export default Index;
