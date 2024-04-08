import React, {useState} from 'react';
import {Modal, ModalBody} from 'reactstrap';

/**
 * Wraps a focusable component & opens a Bootstrap <Modal> containing a copy of the component when focused.
 * Useful for things like textareas which may want more space than the in-flow layout allows.
 * @param {Object} p
 * @param {React.Component} WrappedComponent e.g. a PropControl. Must accept an onFocus handler.
 * @param {*} modal Pulled out to avoid circular calls in e.g. PropControl
 */
export default function PropControl_Modal({WrappedComponent, modal, ...props}) {
	const [modalOpen, setModalOpen] = useState(false);
	const [caretPos, setCaretPos] = useState(false);
	const [, setInputEl] = useState(); // we only access inputEl as its previous value in the setter function

	// When the inline input is focused, open the modal.
	const onFocusInput = e => {
		const evtTarget = e.target; // Extract target from event before entering deferred context
		setTimeout(() => { // Defer to let focus event finish before reading caret position
			// Save caret position from the input if it has one
			if (evtTarget.setSelectionRange) setCaretPos(evtTarget.selectionStart);
			setModalOpen(true);
		});
	};

	// Try to sync the input-in-modal's caret position to the input-inline when opened
	const innerRef = (el) => {
		if (caretPos === false) return;
		// Grab the first textish input - failing that, the first input of any kind.
		let inputEl = el?.querySelectorAll('input, textarea, select, [contenteditable]');
		if (inputEl) inputEl = Array.from(inputEl).find(el => el.setSelectionRange) || inputEl[0];
		// If it was just mounted (ie no previous value) set caret
		const inputElFn = prev => {
			if (inputEl && !prev) {
				inputEl?.setSelectionRange(caretPos, caretPos);
				setTimeout(() => setCaretPos(false));
				inputEl.focus();
			}
			return inputEl;
		};
		setTimeout(() => setInputEl(inputElFn));
	};

	return <>
		<WrappedComponent onFocus={onFocusInput} {...props} />
		<Modal className="modal-propControl"isOpen={modalOpen} toggle={() => setModalOpen(!modalOpen)} fade={false} size="lg" returnFocusAfterClose={false} innerRef={innerRef}>
			<ModalBody>
				<WrappedComponent {...props} />
			</ModalBody>
		</Modal>
	</>;
}

