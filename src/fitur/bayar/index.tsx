import { ModalPembayaran } from './ModalPembayaran.js';

export { ModalPembayaran };

export function LayarBayar() {
  return (
    <ModalPembayaran
      isOpen={true}
      onClose={() => {
        window.location.hash = '#/kasir';
      }}
    />
  );
}
