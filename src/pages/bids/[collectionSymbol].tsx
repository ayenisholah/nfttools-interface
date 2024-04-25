import { IOffer } from "@/services/offers";
import { useSettingsState } from "@/store/settings.store";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

const CollectionBid = () => {
	const [offers, setOffers] = useState<IOffer[]>([]);
	const router = useRouter();
	const { collectionSymbol, data } = router.query;
	const [selectedCollections, setSelectedCollections] = useState<string[]>([]);

	const handleSelectAllBidsChange = (
		event: React.ChangeEvent<HTMLInputElement>
	) => {
		setSelectedCollections(
			event.target.checked ? offers.map((offer) => offer.id) : []
		);
	};

	const handleBidCheckboxChange = (collectionSymbol: string) => {
		const selectedIndex = selectedCollections.indexOf(collectionSymbol);
		let newSelectedCollections: string[] = [];

		if (selectedIndex === -1) {
			newSelectedCollections = [...selectedCollections, collectionSymbol];
		} else {
			newSelectedCollections = selectedCollections.filter(
				(symbol) => symbol !== collectionSymbol
			);
		}

		setSelectedCollections(newSelectedCollections);
	};

	const rowData = data ? JSON.parse(data as string) : null;

	const { apiKey } = useSettingsState();

	useEffect(() => {
		console.log("hello world");

		async function fetchOffers() {
			try {
				const tokenReceiveAddress = rowData.tokenReceiveAddress;
				const url = `/api/offers?requestType=getCollectionOffers&tokenReceiveAddress=${tokenReceiveAddress}&collectionSymbol=${collectionSymbol}&apiKey=${apiKey}`;
				const response = await fetch(url.toString(), {
					method: "GET",
					headers: {
						"Content-Type": "application/json",
					},
				});
				if (!response.ok) {
					throw new Error("Failed to fetch data");
				}
				const responseData: IOffer[] = await response.json();
				setOffers(responseData);
			} catch (error) {
				console.error(error);
			}
		}

		const scheduledLoop = 3;
		const intervalId = setInterval(() => {
			fetchOffers();
		}, scheduledLoop * 1000);

		return () => clearInterval(intervalId);
	}, [apiKey, collectionSymbol, rowData?.tokenReceiveAddress]);

	const calculateMinutesDifference = (expirationDate: number) => {
		const currentTime = Date.now();
		const timeDifference = expirationDate - currentTime;
		const minutesDifference = Math.round(timeDifference / (1000 * 60));
		return minutesDifference;
	};

	return (
		<div className='py-6 px-8 text-white'>
			<h2 className='text-white text-[20px] font-semibold'>
				Collection: {collectionSymbol}
			</h2>
			<p className='my-2 text-[14px] font-medium text-[#AEB9E1]'>
				bid configuration
			</p>
			{rowData && (
				<div key={rowData.collectionSymbol} className='mb-6'>
					<div className='flex flex-wrap gap-3 text-xs'>
						<div className='bg-purple-600 text-white px-3 py-2 rounded'>
							Min Bid: {rowData.minBid}
						</div>
						<div className='bg-purple-600 text-white px-3 py-2 rounded'>
							Max Bid: {rowData.maxBid}
						</div>
						<div className='bg-purple-500 text-white px-3 py-2 rounded'>
							Min Floor Bid: {rowData.minFloorBid}
						</div>
						<div className='bg-purple-500 text-white px-3 py-2 rounded'>
							Max Floor Bid: {rowData.maxFloorBid}
						</div>
						<div className='bg-pink-500 text-white px-3 py-2 rounded'>
							Outbid Margin: {rowData.outBidMargin}
						</div>
						<div className='bg-yellow-400 text-gray-900 px-3 py-2 rounded'>
							Bid Count: {rowData.bidCount}
						</div>
						<div
							className='bg-blue-500 text-white px-3 py-2 rounded'
							title={rowData.fundingWalletWIF}>
							Funding Wallet WIF:{" "}
							{rowData.fundingWalletWIF.slice(0, 5) +
								"....." +
								rowData.fundingWalletWIF.slice(-5)}
						</div>
						<div
							className='bg-blue-500 text-white px-3 py-2 rounded'
							title={rowData.tokenReceiveAddress}>
							Token Receive Address:{" "}
							{rowData.tokenReceiveAddress.slice(0, 5) +
								"....." +
								rowData.tokenReceiveAddress.slice(-5)}
						</div>
						<div className='bg-blue-300 text-gray-900 px-3 py-2 rounded'>
							Duration: {rowData.duration}
						</div>
						<div className='bg-gray-200 text-gray-900 px-3 py-2 rounded'>
							Scheduled Loop: {rowData.scheduledLoop}
						</div>
						<div
							className={`px-3 py-2 text-white rounded ${
								rowData.running ? "bg-green-500" : "bg-red-500"
							}`}>
							Status: {rowData.running ? "Running" : "Stopped"}
						</div>
					</div>
				</div>
			)}

			{/* current bids */}
			<div className='mt-6'>
				<div className='flex justify-end gap-2 mb-6'>
					<button
						className='bg-[#CB3CFF] text-white font-semibold py-2 px-4 rounded'
						onClick={() => {}}>
						Cancel All Offers
					</button>
				</div>
				<div className='relative overflow-x-auto shadow-md'>
					<table className='w-full text-sm text-left text-white border border-[#343B4F] rounded-lg'>
						<thead className='text-xs bg-[#0A1330]'>
							<tr>
								<th scope='col' className='p-4'>
									<div className='flex items-center'>
										<input
											id='checkbox-all-offers'
											type='checkbox'
											className='w-4 h-4 text-[#CB3CFF] bg-gray-100 border-gray-300 rounded focus:ring-[#CB3CFF] dark:focus:ring-[#CB3CFF] dark:ring-offset-gray-800 dark:focus:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600'
											checked={selectedCollections.length === offers.length}
											onChange={handleSelectAllBidsChange}
											style={{ accentColor: "#CB3CFF" }}
										/>
										<label htmlFor='checkbox-all-offers' className='sr-only'>
											Select All Offers
										</label>
									</div>
								</th>
								<th scope='col' className='px-6 py-5'>
									Token ID
								</th>
								<th scope='col' className='px-6 py-5'>
									Offer Price
								</th>

								<th scope='col' className='px-6 py-5'>
									Listed Price
								</th>
								<th scope='col' className='px-6 py-5'>
									Expiration Date
								</th>
								<th scope='col' className='px-6 py-5'>
									Action
								</th>
							</tr>
						</thead>

						<tbody>
							{offers.length > 0 ? (
								offers.map((offer, index) => (
									<tr
										key={index}
										className={`${
											index % 2 === 0 ? "bg-[#0b1739]" : "bg-[#091330]"
										}`}>
										<td className='p-4'>
											<div className='flex items-center'>
												<input
													id={`checkbox-offer-${index}`}
													type='checkbox'
													className='w-4 h-4 text-[#CB3CFF] bg-gray-100 border-gray-300 rounded focus:ring-[#CB3CFF] dark:focus:ring-[#CB3CFF] dark:ring-offset-gray-800 dark:focus:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600'
													style={{ accentColor: "#CB3CFF" }}
													checked={selectedCollections.includes(offer.id)}
													onChange={() => handleBidCheckboxChange(offer.id)}
												/>
												<label
													htmlFor={`checkbox-offer-${index}`}
													className='sr-only'>
													Select Offer
												</label>
											</div>
										</td>
										<td className='px-6 py-5'>
											{"..." + offer.tokenId.slice(-8)}
										</td>
										<td className='px-6 py-5'>{offer.price}</td>
										<td className='px-6 py-5'>{offer.token.listedPrice}</td>
										<td className='px-6 py-5'>
											{calculateMinutesDifference(offer.expirationDate)} m
										</td>
										<td className='flex items-center px-6 py-5'>
											<button
												className='text-red-600 hover:underline'
												onClick={() => {}}>
												Cancel
											</button>
										</td>
									</tr>
								))
							) : (
								<tr>
									<td colSpan={11}>No offers available</td>
								</tr>
							)}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
};

export default CollectionBid;
