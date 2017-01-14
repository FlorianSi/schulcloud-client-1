import SystemSelector from './systemSelector';

class LoginForm extends React.Component {

	constructor(props) {
		super(props);

		this.state = {
			email: '',
			password: '',
			systemId: '0000d186816abba584714c92'	// the id of the 'local' system.
			// TODO: replace with placeholder value, e.g. 'schul-cloud', to be replaced in a hook
		};
	}

	handleFieldChange(key, event) {
		let newState = {};
		newState[key] = event.target.value;
		this.setState(newState);
	}

	handleValueChange(key, value) {
		let newState = {};
		newState[key] = value;
		this.setState(newState);
	}

	handleLogin(e) {
		this.props.actions.login.bind(this)({
			email: this.state.email,
			password: this.state.password,
			schoolId: this.state.schoolId || undefined,
			systemId: this.state.systemId || undefined,
		});
	}


	hasValidSystem() {
		return this.state.systemId != null;
	}

	render() {
		return (
			<div className="form-group">
				<input type="text" className="form-control form-control-lg" placeholder="Email" onChange={this.handleFieldChange.bind(this, 'email')} />
				<input type="password" className="form-control form-control-lg" placeholder="Passwort" onChange={this.handleFieldChange.bind(this, 'password')} />
				<SystemSelector {...this.props}
								onChangeSchoolId={this.handleValueChange.bind(this, 'schoolId')}
								onChangeSystemId={this.handleValueChange.bind(this, 'systemId')} />
				<button className="btn btn-primary btn-block" disabled={!this.hasValidSystem()} onClick={this.handleLogin.bind(this)}>Anmelden</button>
			</div>
		);
	}

}

export default LoginForm;
