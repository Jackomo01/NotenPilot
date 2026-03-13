export const loadGsap = () => {
  if (window.gsap) return;
  const script = document.createElement("script");
  script.src = "https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js";
  script.onload = () => {
    const st = document.createElement("script");
    st.src = "https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js";
    st.onload = () => {
      window.gsap.registerPlugin(window.ScrollTrigger);
      window._gsapReady = true;
      (window._gsapQueue || []).forEach(fn => fn());
    };
    document.head.appendChild(st);
  };
  document.head.appendChild(script);
};

export const onGsapReady = (fn) => {
  if (window._gsapReady) { fn(); return; }
  window._gsapQueue = window._gsapQueue || [];
  window._gsapQueue.push(fn);
};
