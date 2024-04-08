
// see https://manage.auth0.com/dashboard/eu/winterstein/applications/mRqqp4CHdybD2gTt2skAKBnRvvLcAA7a/quickstart

import React from "react";
import { useAuth0 } from "@auth0/auth0-react";
import {Button} from 'reactstrap';

const LoginButton = () => {
  const { loginWithRedirect } = useAuth0();

  return <Button onClick={() => loginWithRedirect()}>Log In</Button>;

};

export const LogoutButton = () => {
	const { logout } = useAuth0();
  
	return (
	  <Button onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}>
		Log Out
	  </Button>
	);
  };

export default LoginButton;
