CREATE TABLE "kategori" (
	"id" text PRIMARY KEY NOT NULL,
	"nama" text NOT NULL,
	"urutan" integer DEFAULT 0 NOT NULL,
	"aktif" boolean DEFAULT true NOT NULL,
	"diubah_pada" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outlet" (
	"id" text PRIMARY KEY NOT NULL,
	"kode" text DEFAULT '',
	"nama" text NOT NULL,
	"alamat" text DEFAULT '',
	"telepon" text DEFAULT '',
	"catatan_struk" text DEFAULT 'Terima kasih atas kunjungan Anda!',
	"aktif" boolean DEFAULT true NOT NULL,
	"sumber" text DEFAULT 'manual',
	"presensi_location_id" text,
	"qris_payload" text,
	"qris_merchant_name" text,
	"qris_merchant_city" text,
	"qris_image" text,
	"diubah_pada" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pengaturan_toko" (
	"kunci" text PRIMARY KEY NOT NULL,
	"nilai" jsonb NOT NULL,
	"diubah_pada" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "produk" ADD COLUMN "gambar" text DEFAULT '';--> statement-breakpoint
ALTER TABLE "produk" ADD COLUMN "kategori" text DEFAULT 'Paket Ayam';--> statement-breakpoint
ALTER TABLE "produk" ADD COLUMN "kategori_id" text;--> statement-breakpoint
ALTER TABLE "produk" ADD COLUMN "hpp" integer DEFAULT 0;