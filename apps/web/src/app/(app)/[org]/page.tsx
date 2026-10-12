import { redirect } from 'next/navigation'

export default async function RacineOrganisation({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params
  redirect(`/${org}/tableau-de-bord`)
}
