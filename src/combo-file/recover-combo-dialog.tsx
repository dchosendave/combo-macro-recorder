import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog"

type RecoverComboDialogProps = {
  open: boolean
  onRecover: () => void
  onCancel: () => void
}

export function RecoverComboDialog({ open, onRecover, onCancel }: RecoverComboDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => { if (!next) onCancel() }}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>Recover this combo?</AlertDialogTitle>
          <AlertDialogDescription>
            The combo could not be opened, but its previous saved version is available.
            Recovering will replace the damaged file with that version.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onRecover}>Recover previous version</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
