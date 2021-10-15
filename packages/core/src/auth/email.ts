import { Auth, Authenticator, AuthenticatorStatus, AuthRequest, AuthServer, AuthType } from "../auth";
import { Messenger } from "../messenger";
import { EmailAuthMessage } from "../messages/mfa";
import { ErrorCode, Err } from "../error";
import { randomNumber } from "../util";

export class EmailAuthServer implements AuthServer {
    constructor(public messenger: Messenger) {}

    supportsType(type: AuthType) {
        return type === AuthType.Email;
    }

    async initAuthenticator(authenticator: Authenticator, auth: Auth, { email = auth.email }: { email?: string } = {}) {
        authenticator.state = { email };
        if (authenticator.status !== AuthenticatorStatus.Active) {
            authenticator.state.activationCode = await this._generateCode();
            this.messenger.send(email, new EmailAuthMessage(authenticator.state.activationCode));
        }
        return { email };
    }

    async activateAuthenticator(authenticator: Authenticator, { code: activationCode }: { code: string }) {
        if (activationCode !== authenticator.state.activationCode) {
            throw new Err(
                ErrorCode.AUTHENTICATION_FAILED,
                "Failed to activate authenticator. Incorrect activation code!"
            );
        }
        authenticator.description = authenticator.state.email;
    }

    async initAuthRequest(authenticator: Authenticator, request: AuthRequest) {
        const verificationCode = await this._generateCode();
        const email = authenticator.state.email;
        request.state = {
            email,
            verificationCode,
        };
        this.messenger.send(authenticator.state.email, new EmailAuthMessage(verificationCode));
        return { email };
    }

    async verifyAuthRequest(
        _method: Authenticator,
        request: AuthRequest,
        { code: verificationCode }: { code: string }
    ) {
        const verified =
            !!request.state.verificationCode &&
            !!verificationCode &&
            request.state.verificationCode === verificationCode;
        if (!verified) {
            throw new Err(ErrorCode.AUTHENTICATION_FAILED, "Incorrect verification code.");
        }
    }

    private async _generateCode(len = 6) {
        return (await randomNumber(0, Math.pow(10, len) - 1)).toString().padStart(len, "0");
    }
}