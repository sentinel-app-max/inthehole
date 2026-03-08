let mapsPromise: Promise<void> | null = null;

export function loadGoogleMaps(): Promise<void> {
  if (mapsPromise) return mapsPromise;

  mapsPromise = new Promise<void>((resolve, reject) => {
    if (typeof google !== "undefined" && google.maps) {
      resolve();
      return;
    }

    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
    if (!key) {
      reject(new Error("Google Maps API key not configured"));
      return;
    }

    const callbackName = "__initGoogleMaps";
    (window as unknown as Record<string, unknown>)[callbackName] = () => {
      resolve();
      delete (window as unknown as Record<string, unknown>)[callbackName];
    };

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=geometry&callback=${callbackName}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(script);
  });

  return mapsPromise;
}
