import { createFileRoute } from '@tanstack/react-router'
import { Template } from '@/features/template'

export const Route = createFileRoute('/_authenticated/')({
  component: Template,
})
