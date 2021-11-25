import {
  RespondToAuthChallengeRequest,
  RespondToAuthChallengeResponse,
} from "aws-sdk/clients/cognitoidentityserviceprovider";
import {
  CodeMismatchError,
  InvalidParameterError,
  NotAuthorizedError,
  UnsupportedError,
} from "../errors";
import { Services } from "../services";
import { generateTokens } from "../services/tokens";

export type RespondToAuthChallengeTarget = (
  req: RespondToAuthChallengeRequest
) => Promise<RespondToAuthChallengeResponse>;

export const RespondToAuthChallenge = ({
  cognitoClient,
  clock,
}: Pick<
  Services,
  "cognitoClient" | "clock"
>): RespondToAuthChallengeTarget => async (req) => {
  if (!req.ChallengeResponses) {
    throw new InvalidParameterError(
      "Missing required parameter challenge responses"
    );
  }
  if (!req.ChallengeResponses.USERNAME) {
    throw new InvalidParameterError("Missing required parameter USERNAME");
  }
  if (!req.Session) {
    throw new InvalidParameterError("Missing required parameter Session");
  }

  const userPool = await cognitoClient.getUserPoolForClientId(req.ClientId);
  const user = await userPool.getUserByUsername(
    req.ChallengeResponses.USERNAME
  );
  if (!user) {
    throw new NotAuthorizedError();
  }

  if (req.ChallengeName === "SMS_MFA") {
    if (user.MFACode !== req.ChallengeResponses.SMS_MFA_CODE) {
      throw new CodeMismatchError();
    }

    await userPool.saveUser({
      ...user,
      MFACode: undefined,
      UserLastModifiedDate: clock.get().getTime(),
    });
  } else if (req.ChallengeName === "NEW_PASSWORD_REQUIRED") {
    if (!req.ChallengeResponses.NEW_PASSWORD) {
      throw new InvalidParameterError(
        "Missing required parameter NEW_PASSWORD"
      );
    }

    // TODO: validate the password?
    await userPool.saveUser({
      ...user,
      Password: req.ChallengeResponses.NEW_PASSWORD,
      UserLastModifiedDate: clock.get().getTime(),
      UserStatus: "CONFIRMED",
    });
  } else {
    throw new UnsupportedError(
      `respondToAuthChallenge with ChallengeName=${req.ChallengeName}`
    );
  }

  return {
    ChallengeParameters: {},
    AuthenticationResult: await generateTokens(
      user,
      req.ClientId,
      userPool.config.Id,
      clock
    ),
  };
};
