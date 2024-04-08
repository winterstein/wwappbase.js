import React, {useState, useEffect} from "react";
import { useAuth0 } from "@auth0/auth0-react";
import Misc from "./Misc";
import LoginButton, {LogoutButton} from "./LoginButtonAuth0";

const Profile = () => {
  const { user, isAuthenticated, isLoading, getAccessTokenSilently } = useAuth0();

  // https://auth0.com/docs/quickstart/spa/react/02-calling-an-api?framed=1&sq=1
//   	const [userMetadata, setUserMetadata] = useState(null);
// 	useEffect(() => {
// 	const getUserMetadata = async () => {
// 	  const domain = "winterstein.eu.auth0.com";
  
// 	  try {
// 		const accessToken = await getAccessTokenSilently({
// 		  authorizationParams: {
// 			audience: `https://${domain}/api/v2/`,
// 			scope: "read:current_user",
// 		  },
// 		});
  
// 		const userDetailsByIdUrl = `https://${domain}/api/v2/users/${user.sub}`;
  
// 		const metadataResponse = await fetch(userDetailsByIdUrl, {
// 		  headers: {
// 			Authorization: `Bearer ${accessToken}`,
// 		  },
// 		});
  
// 		const { user_metadata } = await metadataResponse.json();
  
// 		setUserMetadata(user_metadata);
// 	  } catch (e) {
// 		console.log(e.message);
// 	  }
// 	};
  
// 	getUserMetadata();
//   }, [getAccessTokenSilently, user?.sub]);

  if (isLoading) {
    return <Misc.Loading />;
  }
  if ( ! isAuthenticated) {
	return <div>not logged in</div>
  }

  

  return (
      <div>
        <img src={user.picture} alt={user.name} />
        <h2>{user.name}</h2>
        <p>{user.email}</p>
		{userMetadata? <pre>{JSON.stringify(userMetadata, null, 2)}</pre> : null}
      </div>    
  );
};

export const LoginWidgetAuth0 = () => {
	const { user, isAuthenticated, isLoading } = useAuth0();	
	if ( ! isAuthenticated) {
	  return <LoginButton />;
	}
	if (isLoading) {
		return <Misc.Loading />;
	}
	return (<><Profile />
		<LogoutButton />
	</>);  
};


export default Profile;