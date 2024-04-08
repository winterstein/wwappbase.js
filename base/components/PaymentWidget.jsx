// @Flow
import React, { useEffect, useState } from 'react';
import { Form, FormGroup, Row, Col, Button } from 'reactstrap';

import { Elements,
	CardNumberElement, CardExpiryElement, CardCvcElement,
	PaymentRequestButtonElement,
	useStripe,
	useElements} from '@stripe/react-stripe-js';

import C from '../CBase';
import Money from '../data/Money';
import Transfer from '../data/Transfer';
import { assert, assMatch } from '../utils/assert';
import Misc from './Misc';
import DataStore from '../plumbing/DataStore';
import { loadStripe } from '@stripe/stripe-js';
import ServerIO from '../plumbing/ServerIOBase';
import { space } from '../utils/miscutils';

// Which Stripe API key to use?
const stripeKey = (C.SERVER_TYPE) ? // SERVER_TYPE is falsy on production servers
	'pk_test_RyG0ezFZmvNSP5CWjpl5JQnd' // test
	: 'pk_live_InKkluBNjhUO4XN1QAkCPEGY'; // live

// Dummy / special tokens for "test: pretend I paid", "pay by credit", "promotional free donation"
// The server will catch these token IDs and route them appropriately instead of trying to collect from Stripe
const SKIP_TOKEN = {
	id: 'skip_token',
	type: 'card',
};
const CREDIT_TOKEN = {
	id: 'credit_token',
	type: 'credit',
};
const FREE_TOKEN = {
	id: 'free_token',
	type: 'free',
};

/** Minimum transaction amount by currency: from https://stripe.com/docs/currencies (31/08/18) */
const STRIPE_MINIMUM_AMOUNTS = {
	'GBP': 0.5,
	'USD': 0.75,
	'EUR': 0.75,
	'AUD': 0.75,
	'CAD': 0.5,
	'BRL': 0.5,
	'CHF': 0.5,
	'DKK': 2.5,
	'HKD': 4,
	'JPY': 50,
	'MXN': 10,
	'NOK': 3,
	'NZD': 0.5,
	'SEK': 3,
	'SGD': 0.5
};

/**
 * amount: {?Money} if null, return null
 * recipient: {!String}
 * onToken: {!Function} inputs: token|source, which are similar but different. Sources can be reused
 * 	token = {id:String, type:String, token:String, email:String, type:"card", object:"token"}
 * 	source = {id, card:object, owner: {email, verified_email}, type:"card", object:"source"}
 * 	Called once the user has provided payment details, and we've got a token back from Stripe.
 * 	This should then call the server e.g. by publishing a donation - to take the actual payment.
 * 	The token string is either a Stripe authorisation token, or one of the fixed special values (e.g. credit_token).
 * @param {?Boolean} testOption true/false to show/hide the pretend-I-paid option. Defaults to true on test or local.
 */
const PaymentWidget = ({amount, onToken, recipient, email, usePaymentRequest, error, testOption, repeat, basketId}) => {
	if (!amount) return null; // no amount, no payment

	if (testOption === undefined) {
		testOption = !C.isProduction();
	}

	Money.assIsa(amount, "PaymentWidget.jsx");
	assMatch(onToken, Function, "PaymentWidget.jsx");
	assMatch(recipient, String, "PaymentWidget.jsx");

	// Amount to pay = £0? Then just a confirm button.
	if (Money.value(amount) === 0) {
		return (
			<div className="PaymentWidget">
				<button onClick={() => onToken({ ...FREE_TOKEN, email,	})} className="btn btn-primary">
					Confirm Free Purchase
				</button>
			</div>
		);
	} // ./ £0

	// pay on credit?
	let credit = Transfer.getCredit(); // ??This is kind of SoGive specific
	if (credit && Money.value(credit) > 0) {
		if (Money.value(credit) >= Money.value(amount)) {
			return (
				<div className="section donation-amount">
					<p>You have <Misc.Money amount={credit} /> in credit which will pay for this.</p>
					<button onClick={() => onToken({ ...CREDIT_TOKEN, email, })} className="btn btn-primary">
						Send Payment
					</button>
				</div>
			);
		}
	} // ./credit

	// OK, the payment is non-zero and the user doesn't have enough credit to cover it.
	// So we need a payment processor (currently: Stripe) involved.

	// Promise containing the Stripe object
	const [stripePromise, setStripePromise] = useState();
	// Create once and persist so Stripe Elements don't complain about prop change on re-render
	useEffect(() => setStripePromise(loadStripe(stripeKey)), [stripeKey]);

	// The current PaymentIntent object
	const [paymentIntent, setPaymentIntent] = useState(null);
	// Get a new PaymentIntent if we don't have one, or update it if the payment amount changes
	useEffect(() => {
		// Stripe takes amount in "smallest unit of currency" - i.e. pence in GBP, cents in USD
		const data = {
			action: 'getPaymentIntent',
			amount: Math.round(Money.value(amount) * 100),
			basket: basketId,
			description: space("from", email,basketId, "to",recipient,paymentIntent)
		};
		// If a payment intent exists, ask the server to update it with the new payment amount
		if (paymentIntent) data.id = paymentIntent.id;

		ServerIO.load('/stripe-paymentintent', {data}).then(({cargo}) => setPaymentIntent(cargo));
		// Set null so form remains locked until we get the new/updated PaymentIntent
		setPaymentIntent(null);
	}, [Money.value(amount)]);

	// Don't show the credit card form until the PaymentIntent is ready.
	if (!paymentIntent || !paymentIntent.clientSecret) {
		return (
			<div className="section donation-amount">
				<Misc.Loading text="Preparing your Stripe payment..." />
			</div>
		);
	}

	return (
		<div className="section donation-amount">
			<Elements stripe={stripePromise}>
				<StripeThingsFunctional onToken={onToken} amount={amount} credit={credit} recipient={recipient}
					email={email} usePaymentRequest={usePaymentRequest} serverError={error}
					clientSecret={paymentIntent && paymentIntent.clientSecret}
					repeat={repeat}
				/>
			</Elements>

			{error ? <div className="alert alert-danger">{error}</div> : null}

			{testOption ? (
				<small className="clear">
					Test cards (use any CVC and any future expiry before 2070):<br/>
					4000008260000000 (normal)<br/>
					4000002760003184 (3D Secure auth for first transaction)<br/>
					4000000000009979 (stolen)<br/>
					Or <button onClick={() => onToken({ ...SKIP_TOKEN, email, })}>test: pretend I paid</button>
				</small>
			) : null}
		</div>
	);
};

/**
 * Stripe widgets manage their own state.

 * @Roscoe: Why can't we use DataStore for state? Thanks, Dan
 * @DW: Stripe widgets are wrapped in iframes specifically to promote Stripe's trust model of
 * "we provide the widgets and the host page can't touch your CC data".
 * It's conceivable we could pry that data out, but it's not a good idea.
 */
const StripeThingsFunctional = ({ onToken, amount, credit, recipient, dfltEmail, usePaymentRequest, error: serverError, repeat, clientSecret, disabled }) => {
	// Stripe hooks methods, replacing the old-style provider wrappers that injected these as props
	const stripe = useStripe();
	const elements = useElements();

	const [canMakePayment, setCanMakePayment] = useState(false);
	const [paymentRequest, setPaymentRequest] = useState(null);
	const [email, setEmail] = useState(dfltEmail); // later: allow changing this / setting if not provided
	const [isSaving, setIsSaving] = useState(serverError); // Don't allow submit while there's an unresolved server error
	const [errorMsg, setErrorMsg] = useState();
	const [paymentDone, setPaymentDone] = useState(false);


	const currency = amount.currency || "GBP";

	const isValidAmount = Money.value(amount) >= STRIPE_MINIMUM_AMOUNTS[currency]

	const errors = {}; // TODO uhhh

	/*
		Stripe has a widget which can use the Payments API or
		Google Wallet /	Apple Pay to take payment & turn it into
		a Stripe payment token.
		If the API is available and functioning & the invoking
		component allows its use, skip showing the CC details form
		and just present a single "Pay" button which will make a
		browser-native payment request.
	*/
	useEffect(() => {
		// Don't try to use Payments API unless the invoking component requests it.
		if (!usePaymentRequest) {
			setPaymentRequest(false)
			return;
		}

		// Subtract any SoGive credit from the amount to be paid
		let residual = amount;
		if (credit && Money.value(credit) > 0) {
			residual = Money.sub(amount, credit);
		}

		/* TODO This probably needs updating - but it's dummied out with usePaymentRequest=false anyway */
		const paymentRequestTemp = stripe.paymentRequest({
			country: 'GB',
			currency: currency.toLowerCase(),
			total: {
				label: `Payment to ${recipient}`,
				amount: Math.round(residual.value * 100), // uses pence
			},
		});

		paymentRequestTemp.on('token', ({complete, token, ...data}) => {
			console.log('paymentRequest received Stripe token: ', token);
			console.log('paymentRequest received customer information: ', data);
			onToken(token);
			complete('success');
		});

		paymentRequestTemp.canMakePayment().then(result => {
			if (result) {
				setPaymentRequest(paymentRequestTemp); // Test succeeded, use Payments API
			} else {
				setPaymentRequest(false); // Test failed, fall back to Stripe methods
			}
		});
		// Make sure the payment request object reflects current amount etc
	}, [usePaymentRequest, stripe, Money.value(amount), Money.value(credit)]);
	// ./ not used


	// If the invoking component says to use Payments API if possible...
	if (usePaymentRequest) {
		// We don't know if it's supported yet - show a spinner.
		if (noVal(paymentRequest)) return <Misc.Loading />;
		// It's supported and a PaymentRequest has been created - show the button.
		if (paymentRequest) return <PaymentRequestButtonElement paymentRequest={paymentRequest} />;
	}


	const handleSubmit = (event) => {
		console.log("PaymentWidget - handleSubmit", event);
		// Don't let the browser submit and cause a pageload!
		event.preventDefault();
		// block repeat clicks, and clear old errors
		setIsSaving(true);
		setErrorMsg('');
		console.log("Payment handleSubmit isSaving true");

		const paymentOptions = {
			payment_method: {
				card: elements.getElement(CardNumberElement),
			},
		};

		// For repeating donations, tell Stripe we need off-session authorisation
		// (i.e. can collect with customer not present) for future charges to this card.
		if (repeat && repeat.amount && Money.value(repeat.amount) > 0) {
			paymentOptions.setup_future_usage = 'off_session';
		}

		stripe.confirmCardPayment(clientSecret, {
			...paymentOptions
		}).then(({paymentIntent, error}) => {
			if (paymentIntent) {
				// The payment went through! Pass the completed intent back to the invoking code.
				setPaymentDone(true);
				onToken(paymentIntent);
			} else {
				// Something's gone wrong - handle the error.
				// Card errors are safe to show to the end-user.
				if (error.type === 'card_error') {
					setErrorMsg(error.message);
				}
				// TODO Take action on other errors
			}
			console.log("Payment isSaving false");
			setIsSaving(false);
		});
	} //./handleSubmit()


	// TODO an email editor if email is unset
	return (
		<Form onSubmit={(event) => handleSubmit(event)}>
			<h4>Payment to {recipient}</h4>
			<PaymentAmount amount={amount} repeat={repeat} />
			{credit && Money.value(credit) > 0?
				<FormGroup><Col md="12">
					You have <Misc.Money amount={credit} /> in credit which will be used towards this payment.
				</Col></FormGroup>
			: null}

			<Row>
				<Col md="12">
					<FormGroup>
						<label>Card number</label>
						<div className="form-control">
							<CardNumberElement placeholder="0000 0000 0000 0000" />
						</div>
					</FormGroup>
				</Col>
			</Row>
			<Row>
				<Col md="6">
					<FormGroup>
						<label>Expiry date</label>
						<div className="form-control">
							<CardExpiryElement />
						</div>
					</FormGroup>
				</Col>
				<Col md="6">
					<FormGroup>
						<label>CVC</label>
						<div className="form-control">
							<CardCvcElement />
						</div>
					</FormGroup>
				</Col>
			</Row>

			<Button color="primary" size="lg" className="pull-right" type="submit"
				disabled={paymentDone || isSaving || !isValidAmount}
				title={isValidAmount ? null : 'Your payment must be at least ' + STRIPE_MINIMUM_AMOUNTS[currency] + currency}
			>
				Submit Payment
			</Button>
			{errors.errorMsg? <div className="alert alert-danger">{errors.errorMsg}</div> : null}
		</Form>
	);
} // ./StripeThingsClass

const PaymentAmount = ({amount, repeat = {}}) => {
	if (!repeat.amount) {
		return <h4><Misc.Money amount={amount} /></h4>;
	}
		// TODO {repeatEnd}
	if (Money.value(repeat.amount) === Money.value(amount)) {
		return (<>
			<h4><Misc.Money amount={amount} /> {Donation.strRepeat(repeat.freq)} {repeat.end}</h4>
			<div>The regular payment can be cancelled at any time.</div>
		</>);
	}
	return (<>
		<h4><Misc.Money amount={amount} /> now.</h4>
		<h4>Then <Misc.Money amount={repeat.amount} /> {Donation.strRepeat(repeat.freq)}.</h4>
		<div>The regular payment can be cancelled at any time.</div>
	</>);	
};

// const StripeThings = injectStripe(StripeThingsClass);

export {SKIP_TOKEN};
export default PaymentWidget;
