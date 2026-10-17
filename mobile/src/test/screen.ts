import { fireEvent, screen } from 'expo-router/testing-library';

export async function press(name: string) {
  await fireEvent.press(screen.getByRole('button', { name }));
}

export async function type(label: string, text: string) {
  await fireEvent.changeText(screen.getByLabelText(label), text);
}
