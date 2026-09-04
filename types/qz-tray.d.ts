// A lib qz-tray (https://github.com/qzind/tray) não publica tipos — é um
// módulo UMD antigo pensado pra ser carregado direto no browser. Este é
// só o subconjunto da API que lib/qz.ts usa.
declare module "qz-tray" {
  interface QZPrintConfig {
    (printer: string, options?: Record<string, unknown>): unknown;
  }

  interface QZ {
    websocket: {
      connect: (options?: Record<string, unknown>) => Promise<void>;
      disconnect: () => Promise<void>;
      isActive: () => boolean;
    };
    printers: {
      find: (query?: string) => Promise<string | string[]>;
      getDefault: () => Promise<string>;
    };
    configs: {
      create: QZPrintConfig;
    };
    print: (config: unknown, data: unknown[]) => Promise<void>;
    security: {
      setCertificatePromise: (fn: () => Promise<string>) => void;
      setSignaturePromise: (
        fn: (toSign: string) => (resolve: (signature: string) => void, reject: (err: unknown) => void) => void
      ) => void;
    };
  }

  const qz: QZ;
  export default qz;
}
