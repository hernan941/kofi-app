import { useState } from 'react';
import { View } from 'react-native';

import { PrimaryButton, Sheet } from '@/shared/ui';

import { WeeklyReminderFields, type WeeklyReminderValue } from './weekly-reminder-fields';

/** Props of {@link WeeklyReminderSheet}. */
export interface WeeklyReminderSheetProps {
  readonly isOpen: boolean;
  /** Valores guardados; la hoja abre con ellos. */
  readonly weekly: WeeklyReminderValue;
  /** "Guardar": entrega día y minuto del día juntos; la pantalla decide si cierra. */
  readonly onSave: (value: WeeklyReminderValue) => void;
  /** Cerrar sin guardar (deslizar, tocar fuera, atrás de Android). */
  readonly onClose: () => void;
}

/** Cuerpo con su borrador; se monta al abrir, así cada apertura parte de lo guardado. */
function SheetBody({ weekly, onSave }: Pick<WeeklyReminderSheetProps, 'weekly' | 'onSave'>) {
  const [draft, setDraft] = useState<WeeklyReminderValue>(weekly);
  return (
    <View className="gap-6">
      <WeeklyReminderFields value={draft} onChange={setDraft} />
      <PrimaryButton
        label="Guardar"
        onPress={() => {
          onSave(draft);
        }}
      />
    </View>
  );
}

/** Hoja "Día y hora del recordatorio" (F7.1, 3.4). Cerrarla descarta los cambios. */
export function WeeklyReminderSheet({ isOpen, weekly, onSave, onClose }: WeeklyReminderSheetProps) {
  return (
    <Sheet isOpen={isOpen} title="Día y hora del recordatorio" onClose={onClose}>
      {isOpen ? <SheetBody weekly={weekly} onSave={onSave} /> : null}
    </Sheet>
  );
}
