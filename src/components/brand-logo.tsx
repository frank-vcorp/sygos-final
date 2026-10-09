import Image from "next/image";

export function CompanyLogo({
  code,
  className = "",
}: {
  code: string | null;
  className?: string;
}) {
  const systron = code === "SYSTRON";
  return (
    <span className={`inline-flex items-center rounded-md ${systron ? "bg-[#1b252c] px-3 py-2" : "bg-white px-2 py-1"} ${className}`}>
      <Image
        src={systron ? "/brand/systron.png" : "/brand/servomotores.png"}
        alt={systron ? "SYSTRON Industria" : "SYSTRON Servomotores"}
        width={systron ? 200 : 240}
        height={systron ? 49 : 55}
        className="h-10 w-auto object-contain"
      />
    </span>
  );
}
