declare module "qrcode" {
  export function toDataURL(value: string): Promise<string>;
}
