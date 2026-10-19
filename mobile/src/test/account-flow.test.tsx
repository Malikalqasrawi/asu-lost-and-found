import * as SecureStore from 'expo-secure-store';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Alert, Appearance } from 'react-native';

import { clearTokens } from '@/session/tokens';
import { authResponse, emptyBrowse, mockApi, requestsTo, signedIn } from '@/test/mock-api';
import { press, type } from '@/test/screen';

const { resetSecureStore } = SecureStore as unknown as { resetSecureStore: () => void };

const newEmail = '123456789@students.asu.edu.jo';

async function pressWhenShown(name: string) {
  await screen.findByRole('button', { name });
  await press(name);
}

async function openAccount(routes: Parameters<typeof mockApi>[0] = {}) {
  const fetchMock = mockApi({ ...signedIn, ...emptyBrowse, ...routes });
  await renderRouter('./src/app');
  await screen.findByText('Hi, Ahmad');
  await fireEvent.press(screen.getByText('Account'));
  await screen.findByRole('button', { name: 'Change email' });
  return fetchMock;
}

describe('account settings', () => {
  let fetchMock: jest.SpyInstance | undefined;
  beforeEach(async () => {
    process.env.EXPO_PUBLIC_API_URL = 'http://10.0.2.2:4000/api';
    resetSecureStore();
    await clearTokens();
    await SecureStore.setItemAsync('refreshToken', 'stored-refresh');
  });

  afterEach(() => {
    fetchMock?.mockRestore();
    jest.restoreAllMocks();
  });

  it('switches between the system, light and dark looks and remembers the choice', async () => {
    const setScheme = jest.spyOn(Appearance, 'setColorScheme');
    fetchMock = await openAccount();

    await press('Dark');
    expect(setScheme).toHaveBeenLastCalledWith('dark');
    expect(await SecureStore.getItemAsync('appearance')).toBe('dark');

    await press('System');
    expect(setScheme).toHaveBeenLastCalledWith('unspecified');
    await waitFor(async () => expect(await SecureStore.getItemAsync('appearance')).toBeNull());
  });

  it('changes the email with the password and the code sent to the new address', async () => {
    let started: unknown;
    fetchMock = await openAccount({
      'POST /users/me/email': (body) => {
        started = body;
        return [202, { message: 'A 6-digit code is on its way.' }];
      },
      'POST /users/me/email/confirm': (body) =>
        body.code === '482913'
          ? [200, { ...authResponse, user: { ...authResponse.user, email: newEmail } }]
          : [400, { message: 'The code is wrong or has expired' }],
    });

    await press('Change email');
    await type('New email', newEmail);
    await press('Send code');
    expect(screen.getByText('Enter the new email and your password.')).toBeOnTheScreen();
    await type('Your password', 'correct-horse-42');
    await press('Send code');
    expect(
      await screen.findByText(
        new RegExp(`If ${newEmail} can be used for an account, a 6-digit code`),
      ),
    ).toBeOnTheScreen();
    await type('Code', '482 913');
    await press('Confirm new email');

    expect(await screen.findByText(newEmail)).toBeOnTheScreen();
    expect(started).toEqual({ newEmail, password: 'correct-horse-42' });
  });

  it('asks a Microsoft-only account for an emailed code instead of a password', async () => {
    let started: unknown;
    fetchMock = await openAccount({
      'GET /users/me': () => [200, { ...authResponse.user, hasPassword: false }],
      'POST /users/me/confirmation-code': () => [202, { message: 'A 6-digit code is on its way.' }],
      'POST /users/me/email': (body) => {
        started = body;
        return [202, { message: 'A 6-digit code is on its way.' }];
      },
    });

    await press('Change email');
    expect(screen.queryByLabelText('Your password')).toBeNull();
    await press('Email me a code');
    expect(await screen.findByText('We emailed you a 6-digit code.')).toBeOnTheScreen();
    await type('New email', newEmail);
    await type('Code from the email', '771 204');
    await press('Send code');

    await waitFor(() => expect(started).toEqual({ newEmail, code: '771204' }));
  });

  it('shows why the new email was refused and stays on the first step', async () => {
    fetchMock = await openAccount({
      'POST /users/me/email': () => [409, { message: 'That email already has an account.' }],
    });

    await press('Change email');
    await type('New email', newEmail);
    await type('Your password', 'correct-horse-42');
    await press('Send code');

    expect(await screen.findByText('That email already has an account.')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Code')).toBeNull();
  });

  it('keeps asking for the code when it is wrong', async () => {
    fetchMock = await openAccount({
      'POST /users/me/email': () => [202, { message: 'A 6-digit code is on its way.' }],
      'POST /users/me/email/confirm': () => [400, { message: 'The code is wrong or has expired' }],
    });

    await press('Change email');
    await type('New email', newEmail);
    await type('Your password', 'correct-horse-42');
    await pressWhenShown('Send code');
    await screen.findByLabelText('Code');
    await type('Code', '000000');
    await press('Confirm new email');

    expect(await screen.findByText('The code is wrong or has expired')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Confirm new email' })).toBeOnTheScreen();
    expect(await SecureStore.getItemAsync('refreshToken')).toBe('refresh-2');
  });

  it('shows when the confirmation code could not be emailed', async () => {
    fetchMock = await openAccount({
      'GET /users/me': () => [200, { ...authResponse.user, hasPassword: false }],
      'POST /users/me/confirmation-code': () => [
        429,
        { message: 'Too many emails. Try again later.' },
      ],
    });

    await press('Change email');
    await press('Email me a code');

    expect(await screen.findByText('Too many emails. Try again later.')).toBeOnTheScreen();
    expect(screen.queryByText('We emailed you a 6-digit code.')).toBeNull();
  });

  it('deletes the account after asking, then signs out', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((button) => button.text === 'Delete')?.onPress?.();
    });
    let sent: unknown;
    fetchMock = await openAccount({
      'DELETE /users/me': (body) => {
        sent = body;
        return [204];
      },
      'POST /auth/logout': () => [204],
    });

    await press('Delete account');
    await pressWhenShown('Delete my account');
    expect(await screen.findByText('Enter your password.')).toBeOnTheScreen();
    await type('Your password', 'correct-horse-42');
    await press('Delete my account');

    expect(await screen.findByRole('header', { name: 'Sign in' })).toBeOnTheScreen();
    expect(sent).toEqual({ password: 'correct-horse-42' });
    expect(await SecureStore.getItemAsync('refreshToken')).toBeNull();
  });

  it('keeps the account when the student cancels', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((button) => button.text === 'Cancel')?.onPress?.();
    });
    fetchMock = await openAccount();

    await press('Delete account');
    await type('Your password', 'correct-horse-42');
    await pressWhenShown('Delete my account');

    expect(Alert.alert).toHaveBeenCalledWith(
      'Delete your account?',
      'This cannot be undone.',
      expect.any(Array),
    );
    expect(requestsTo(fetchMock, 'DELETE', '/users/me')).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Delete my account' })).toBeOnTheScreen();
  });

  it('deletes a Microsoft-only account with the emailed code', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((button) => button.text === 'Delete')?.onPress?.();
    });
    let sent: unknown;
    fetchMock = await openAccount({
      'GET /users/me': () => [200, { ...authResponse.user, hasPassword: false }],
      'POST /users/me/confirmation-code': () => [202, { message: 'A 6-digit code is on its way.' }],
      'DELETE /users/me': (body) => {
        sent = body;
        return [204];
      },
      'POST /auth/logout': () => [204],
    });

    await press('Delete account');
    await pressWhenShown('Email me a code');
    await screen.findByText('We emailed you a 6-digit code.');
    await type('Code from the email', '771 204');
    await press('Delete my account');

    expect(await screen.findByRole('header', { name: 'Sign in' })).toBeOnTheScreen();
    expect(sent).toEqual({ code: '771204' });
  });

  it('shows why the account cannot be deleted yet', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((button) => button.text === 'Delete')?.onPress?.();
    });
    fetchMock = await openAccount({
      'DELETE /users/me': () => [
        409,
        {
          message:
            'Finish your handovers first: an item is still waiting to change hands or is with the security office.',
        },
      ],
    });

    await press('Delete account');
    await type('Your password', 'correct-horse-42');
    await pressWhenShown('Delete my account');

    expect(await screen.findByText(/Finish your handovers first/)).toBeOnTheScreen();
    expect(requestsTo(fetchMock, 'DELETE', '/users/me')).toHaveLength(1);
  });
});
