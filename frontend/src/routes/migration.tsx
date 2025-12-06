import { MigrationWizard } from "@/components/migration/migration-wizard"
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/migration')({
  component: MigrationPage,
})

function MigrationPage() {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Data Migration</h1>
      <MigrationWizard />
    </div>
  )
}
