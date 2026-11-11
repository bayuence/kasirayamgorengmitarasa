CREATE TABLE "item_pesanan" (
	"id" uuid PRIMARY KEY NOT NULL,
	"pesanan_id" uuid NOT NULL,
	"produk_id" uuid NOT NULL,
	"nama_produk" text NOT NULL,
	"qty" integer NOT NULL,
	"harga_satuan" integer NOT NULL,
	"tambahan" jsonb DEFAULT '[]'::jsonb NOT NULL,
	CONSTRAINT "item_pesanan_qty_check" CHECK ("item_pesanan"."qty" > 0)
);
--> statement-breakpoint
CREATE TABLE "log_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"waktu" timestamp with time zone DEFAULT now() NOT NULL,
	"pengguna_id" uuid,
	"aksi" text NOT NULL,
	"detail" jsonb
);
--> statement-breakpoint
CREATE TABLE "pesanan" (
	"id" uuid PRIMARY KEY NOT NULL,
	"kode_perangkat" text NOT NULL,
	"nomor" integer NOT NULL,
	"tanggal" date NOT NULL,
	"waktu" timestamp with time zone NOT NULL,
	"jenis" text NOT NULL,
	"status" text DEFAULT 'selesai' NOT NULL,
	"metode" text NOT NULL,
	"total" integer NOT NULL,
	"bayar" integer NOT NULL,
	"kembalian" integer DEFAULT 0 NOT NULL,
	"catatan" text,
	"alasan_batal" text,
	"shift_id" uuid,
	"kasir_id" uuid NOT NULL,
	CONSTRAINT "pesanan_tanggal_kode_perangkat_nomor_key" UNIQUE("tanggal","kode_perangkat","nomor"),
	CONSTRAINT "pesanan_jenis_check" CHECK ("pesanan"."jenis" in ('makan_di_tempat', 'bawa_pulang')),
	CONSTRAINT "pesanan_status_check" CHECK ("pesanan"."status" in ('selesai', 'batal')),
	CONSTRAINT "pesanan_metode_check" CHECK ("pesanan"."metode" in ('tunai', 'qris')),
	CONSTRAINT "pesanan_total_check" CHECK ("pesanan"."total" >= 0),
	CONSTRAINT "pesanan_bayar_check" CHECK ("pesanan"."bayar" >= 0)
);
--> statement-breakpoint
CREATE TABLE "produk" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"varian" text NOT NULL,
	"paket" text NOT NULL,
	"isi" text DEFAULT '' NOT NULL,
	"harga" integer NOT NULL,
	"urutan" integer DEFAULT 0 NOT NULL,
	"aktif" boolean DEFAULT true NOT NULL,
	"diubah_pada" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "produk_harga_check" CHECK ("produk"."harga" >= 0)
);
--> statement-breakpoint
CREATE TABLE "profil" (
	"id" uuid PRIMARY KEY NOT NULL,
	"nama" text NOT NULL,
	"peran" text DEFAULT 'kasir' NOT NULL,
	"dibuat_pada" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profil_peran_check" CHECK ("profil"."peran" in ('owner', 'kasir'))
);
--> statement-breakpoint
CREATE TABLE "shift" (
	"id" uuid PRIMARY KEY NOT NULL,
	"kasir_id" uuid NOT NULL,
	"buka_pada" timestamp with time zone NOT NULL,
	"tutup_pada" timestamp with time zone,
	"kas_awal" integer DEFAULT 0 NOT NULL,
	"kas_akhir" integer,
	"selisih" integer
);
--> statement-breakpoint
CREATE TABLE "tambahan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nama" text NOT NULL,
	"harga" integer NOT NULL,
	"urutan" integer DEFAULT 0 NOT NULL,
	"aktif" boolean DEFAULT true NOT NULL,
	"diubah_pada" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tambahan_harga_check" CHECK ("tambahan"."harga" >= 0)
);
--> statement-breakpoint
ALTER TABLE "item_pesanan" ADD CONSTRAINT "item_pesanan_pesanan_id_pesanan_id_fk" FOREIGN KEY ("pesanan_id") REFERENCES "public"."pesanan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_pesanan" ADD CONSTRAINT "item_pesanan_produk_id_produk_id_fk" FOREIGN KEY ("produk_id") REFERENCES "public"."produk"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "log_audit" ADD CONSTRAINT "log_audit_pengguna_id_profil_id_fk" FOREIGN KEY ("pengguna_id") REFERENCES "public"."profil"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pesanan" ADD CONSTRAINT "pesanan_shift_id_shift_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shift"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pesanan" ADD CONSTRAINT "pesanan_kasir_id_profil_id_fk" FOREIGN KEY ("kasir_id") REFERENCES "public"."profil"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profil" ADD CONSTRAINT "profil_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift" ADD CONSTRAINT "shift_kasir_id_profil_id_fk" FOREIGN KEY ("kasir_id") REFERENCES "public"."profil"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "item_pesanan_pesanan_id_idx" ON "item_pesanan" USING btree ("pesanan_id");--> statement-breakpoint
CREATE INDEX "pesanan_tanggal_idx" ON "pesanan" USING btree ("tanggal");