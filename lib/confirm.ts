import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";

type ConfirmDialogOptions = {
  title: string;
  text?: string;
  confirmText?: string;
  danger?: boolean;
};

export async function confirmDialog(opts: ConfirmDialogOptions): Promise<boolean> {
  const res = await Swal.fire({
    title: opts.title,
    text: opts.text,
    showCancelButton: true,
    confirmButtonText: opts.confirmText ?? "Confirm",
    cancelButtonText: "Cancel",
    buttonsStyling: false,
    showClass: { popup: "" },
    customClass: {
      container: "sym-swal-container",
      popup: "sym-swal-popup",
      title: "sym-swal-title",
      htmlContainer: "sym-swal-text",
      actions: "sym-swal-actions",
      confirmButton: opts.danger ? "sym-swal-confirm-danger" : "sym-swal-confirm",
      cancelButton: "sym-swal-cancel",
    },
  });

  return res.isConfirmed;
}
