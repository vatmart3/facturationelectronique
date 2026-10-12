/** Adresse publique d'un fichier du stockage (serveur et navigateur). */
export function urlPublique(bucket: string, chemin: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${chemin}`
}
