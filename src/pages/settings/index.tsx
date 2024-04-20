import InvisibleIcon from "@/assets/icons/InvisibleIcon";
import VisibleIcon from "@/assets/icons/VisibleIcon";
import Toast from "@/components/Toast";
import { useSettingsState } from "@/store/settings.store";
import React, { useEffect, useState } from "react";

const Settings: React.FC = () => {
	const [showPassword, setShowPassword] = useState(false);
	const [showToast, setShowToast] = useState(false);

	const {
		apiKey,
		fundingWif,
		tokenReceiveAddress,
		rateLimit,
		bidExpiration,
		defaultOutbidMargin,
		defaultLoopTime,
		defaultCounterLoopTime,
		updateSettings,
	} = useSettingsState();

	console.log({ rateLimit });

	const [formState, setFormState] = useState<SettingsState>({
		apiKey: apiKey,
		fundingWif: fundingWif,
		tokenReceiveAddress: tokenReceiveAddress,
		rateLimit: rateLimit,
		bidExpiration: bidExpiration,
		defaultOutbidMargin: defaultOutbidMargin,
		defaultLoopTime: defaultLoopTime,
		defaultCounterLoopTime: defaultCounterLoopTime,
	});

	useEffect(() => {
		setFormState({
			apiKey: apiKey,
			fundingWif: fundingWif,
			tokenReceiveAddress: tokenReceiveAddress,
			rateLimit: rateLimit,
			bidExpiration: bidExpiration,
			defaultOutbidMargin: defaultOutbidMargin,
			defaultLoopTime: defaultLoopTime,
			defaultCounterLoopTime: defaultCounterLoopTime,
		});
	}, [
		apiKey,
		bidExpiration,
		defaultCounterLoopTime,
		defaultLoopTime,
		defaultOutbidMargin,
		fundingWif,
		rateLimit,
		tokenReceiveAddress,
	]);

	const togglePasswordVisibility = () => {
		setShowPassword(!showPassword);
	};

	const handleInputChange = (
		e: React.ChangeEvent<HTMLInputElement>,
		field: keyof SettingsState
	) => {
		const value = e.target.value;
		setFormState((prevState) => ({
			...prevState,
			[field]: value,
		}));

		updateSettings({ [field]: value });
	};

	const handleNumberInputChange = (
		e: React.ChangeEvent<HTMLInputElement>,
		field: keyof SettingsState
	) => {
		const value = e.target.value;
		if (value === "" || (Number(value) >= 0 && Number(value) < Infinity)) {
			setFormState((prevState) => ({
				...prevState,
				[field]: value,
			}));
		}

		updateSettings({ [field]: Number(value) });
	};

	function saveSettings() {
		setShowToast(true);
	}

	return (
		<div className='py-[30px] px-[40px]'>
			{showToast && (
				<Toast
					id='toast-success'
					icon={
						<svg
							className='w-5 h-5'
							aria-hidden='true'
							xmlns='http://www.w3.org/2000/svg'
							fill='currentColor'
							viewBox='0 0 20 20'>
							<path d='M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5Zm3.707 8.207-4 4a1 1 0 0 1-1.414 0l-2-2a1 1 0 0 1 1.414-1.414L9 10.586l3.293-3.293a1 1 0 0 1 1.414 1.414Z' />
						</svg>
					}
					text='Settings saved successfully.'
				/>
			)}
			<h2 className='text-white text-[20px] font-semibold'>Settings</h2>
			<p className='mt-2 text-[14px] font-medium text-[#AEB9E1]'>
				Default bidding configuration
			</p>

			<div className='mt-6 w-[600px] border border-[#343B4F] rounded-xl p-8 bg-[#0b1739]'>
				<div>
					<label
						htmlFor='api_key'
						className='block mb-2 text-sm font-medium text-white'>
						API KEY
					</label>
					<input
						type='text'
						id='api_key'
						className='p-[14px] bg-transparent border border-[#343B4F] w-full rounded text-white'
						placeholder=''
						value={formState.apiKey}
						onChange={(e) => handleInputChange(e, "apiKey")}
						required
					/>
				</div>
				<div className='mt-6 relative'>
					<label
						htmlFor='funding_wif'
						className='block mb-2 text-sm font-medium text-white'>
						FUNDING WIF
					</label>
					<input
						type={showPassword ? "text" : "password"}
						id='funding_wif'
						className='p-[14px] bg-transparent border border-[#343B4F] w-full rounded text-white pr-10'
						placeholder=''
						value={formState.fundingWif}
						onChange={(e) => handleInputChange(e, "fundingWif")}
						required
					/>
					<button
						type='button'
						className='absolute right-5 top-[42px] text-white focus:outline-none'
						onClick={togglePasswordVisibility}>
						{showPassword ? <InvisibleIcon /> : <VisibleIcon />}
					</button>
				</div>
				<div className='mt-6'>
					<label
						htmlFor='token_receive_address'
						className='block mb-2 text-sm font-medium text-white'>
						TOKEN RECEIVE ADDRESS
					</label>
					<input
						type='text'
						id='token_receive_address'
						className='p-[14px] bg-transparent border border-[#343B4F] w-full rounded text-white'
						placeholder=''
						value={formState.tokenReceiveAddress}
						onChange={(e) => handleInputChange(e, "tokenReceiveAddress")}
						required
					/>
				</div>
				<div className='mt-6'>
					<label
						htmlFor='rate_limit'
						className='block mb-2 text-sm font-medium text-white'>
						RATE LIMIT
					</label>
					<input
						type='number'
						id='rate_limit'
						className='p-[14px] bg-transparent border border-[#343B4F] rounded text-white inline-block w-auto'
						placeholder=''
						inputMode='numeric'
						value={formState.rateLimit}
						onChange={(e) => handleNumberInputChange(e, "rateLimit")}
						required
					/>
				</div>
				<div className='mt-6'>
					<label
						htmlFor='bid_expiration'
						className='block mb-2 text-sm font-medium text-white'>
						BID EXPIRATION (minutes)
					</label>
					<input
						type='number'
						id='bid_expiration'
						className='p-[14px] bg-transparent border border-[#343B4F] rounded text-white inline-block w-auto'
						placeholder=''
						inputMode='numeric'
						value={formState.bidExpiration}
						onChange={(e) => handleNumberInputChange(e, "bidExpiration")}
						required
					/>
				</div>
				<div className='mt-6'>
					<label
						htmlFor='default_outbid_margin'
						className='block mb-2 text-sm font-medium text-white'>
						DEFAULT OUTBID MARGIN (BTC)
					</label>
					<input
						type='number'
						id='default_outbid_margin'
						className='p-[14px] bg-transparent border border-[#343B4F] rounded text-white inline-block w-auto'
						placeholder=''
						inputMode='numeric'
						value={formState.defaultOutbidMargin}
						onChange={(e) => handleNumberInputChange(e, "defaultOutbidMargin")}
						required
					/>
				</div>
				<div className='mt-6'>
					<label
						htmlFor='default_loop_time'
						className='block mb-2 text-sm font-medium text-white'>
						DEFAULT LOOP TIME (seconds)
					</label>
					<input
						type='number'
						id='default_loop_time'
						className='p-[14px] bg-transparent border border-[#343B4F] rounded text-white inline-block w-auto'
						placeholder=''
						inputMode='numeric'
						value={formState.defaultLoopTime}
						onChange={(e) => handleNumberInputChange(e, "defaultLoopTime")}
						required
					/>
				</div>
				<div className='mt-6'>
					<label
						htmlFor='default_counter_loop_time'
						className='block mb-2 text-sm font-medium text-white'>
						DEFAULT COUNTER LOOP TIME (seconds)
					</label>
					<input
						type='number'
						id='default_counter_loop_time'
						className='p-[14px] bg-transparent border border-[#343B4F] rounded text-white inline-block w-auto'
						placeholder=''
						inputMode='numeric'
						value={formState.defaultCounterLoopTime}
						onChange={(e) =>
							handleNumberInputChange(e, "defaultCounterLoopTime")
						}
						required
					/>
				</div>

				<div className='flex justify-end mt-6'>
					<button
						className='bg-[#CB3CFF] py-[14px] w-[180px] font-semibold text-white text-sm rounded'
						onClick={saveSettings}>
						SAVE
					</button>
				</div>
			</div>
		</div>
	);
};

export default Settings;

interface SettingsState {
	apiKey: string;
	fundingWif: string;
	tokenReceiveAddress: string;
	rateLimit: number;
	bidExpiration: number;
	defaultOutbidMargin: number;
	defaultLoopTime: number;
	defaultCounterLoopTime: number;
}
