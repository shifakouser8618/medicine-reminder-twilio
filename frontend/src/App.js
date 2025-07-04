import React, { useState, useEffect } from 'react';
import {
  Container,
  Form,
  Button,
  Row,
  Col,
  Alert,
  Card,
  InputGroup,
  Dropdown,
  DropdownButton,
} from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTrashAlt, faFileUpload, faVolumeUp, faSave, faDownload, faSpinner } from '@fortawesome/free-solid-svg-icons';

function App() {
  const [elderName, setElderName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [voiceUploadFile, setVoiceUploadFile] = useState(null); // For new uploads
  const [selectedVoiceFile, setSelectedVoiceFile] = useState(''); // For existing files
  const [availableVoiceFiles, setAvailableVoiceFiles] = useState([]);
  const [medicines, setMedicines] = useState([
    { name: '', dosage: '', type: 'Tablet', notes: '', image: '' },
  ]);
  const [reminderTimes, setReminderTimes] = useState(['']);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const API_BASE_URL = 'http://localhost:5000'; // Make sure this matches your Flask backend URL

  useEffect(() => {
    fetchAvailableVoiceFiles();
  }, []);

  const fetchAvailableVoiceFiles = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/voice_files`);
      if (res.ok) {
        const data = await res.json();
        setAvailableVoiceFiles(data.voice_files);
      } else {
        console.error('Failed to fetch voice files:', await res.json());
      }
    } catch (err) {
      console.error('Error fetching voice files:', err);
    }
  };

  const handleMedicineChange = (index, field, value) => {
    const newMeds = [...medicines];
    newMeds[index][field] = value;
    setMedicines(newMeds);
  };

  const addMedicine = () => {
    setMedicines([
      ...medicines,
      { name: '', dosage: '', type: 'Tablet', notes: '', image: '' },
    ]);
  };

  const removeMedicine = (index) => {
    const newMeds = medicines.filter((_, i) => i !== index);
    setMedicines(newMeds);
  };

  const handleTimeChange = (index, value) => {
    const newTimes = [...reminderTimes];
    newTimes[index] = value;
    setReminderTimes(newTimes);
  };

  const addTime = () => {
    setReminderTimes([...reminderTimes, '']);
  };

  const removeTime = (index) => {
    const newTimes = reminderTimes.filter((_, i) => i !== index);
    setReminderTimes(newTimes);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setIsLoading(true);

    const formData = new FormData();
    formData.append('elder_name', elderName);
    formData.append('phone_number', phoneNumber);
    formData.append('reminder_times', JSON.stringify(reminderTimes));

    if (voiceUploadFile) {
      formData.append('voice_upload', voiceUploadFile); // Use 'voice_upload' for new files
    } else if (selectedVoiceFile) {
      formData.append('selected_voice_file', selectedVoiceFile); // Use 'selected_voice_file' for existing
    }

    medicines.forEach((med, idx) => {
      formData.append(`medicines[${idx}][name]`, med.name);
      formData.append(`medicines[${idx}][dosage]`, med.dosage);
      formData.append(`medicines[${idx}][type]`, med.type);
      formData.append(`medicines[${idx}][notes]`, med.notes);
      formData.append(`medicines[${idx}][image]`, med.image); // This is the image URL
    });

    try {
      const res = await fetch(`${API_BASE_URL}/api/schedule`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        setMessage(`✅ ${data.message}`);
        // Optionally clear form after successful submission
        setElderName('');
        setPhoneNumber('');
        setVoiceUploadFile(null);
        setSelectedVoiceFile('');
        setMedicines([{ name: '', dosage: '', type: 'Tablet', notes: '', image: '' }]);
        setReminderTimes(['']);
      } else {
        setMessage(`❌ Error: ${data.error}`);
      }
    } catch (err) {
      setMessage('❌ Failed to reach backend. Please ensure the server is running and accessible.');
      console.error("Fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportCsv = async () => {
    setMessage('⏳ Exporting logs...');
    try {
      const res = await fetch(`${API_BASE_URL}/api/export_csv`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(new Blob([blob]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'reminder_logs.csv');
        document.body.appendChild(link);
        link.click();
        link.parentNode.removeChild(link);
        setMessage('✅ Logs exported successfully!');
      } else {
        setMessage('❌ Failed to export logs.');
      }
    } catch (err) {
      setMessage('❌ Error exporting logs.');
      console.error("Export error:", err);
    }
  };

  return (
    <Container className="my-5">
      <h1 className="text-center mb-4 text-primary">
        <FontAwesomeIcon icon={faVolumeUp} /> Elder Care Medicine Reminder
      </h1>
      <p className="text-center mb-5 text-muted">
        Effortlessly schedule medicine reminders via calls and WhatsApp for your loved ones.
      </p>

      <Card className="shadow-lg p-4 mb-5 bg-white rounded">
        <Card.Body>
          <Card.Title className="mb-4 text-center text-secondary">
            Set Up New Reminder
          </Card.Title>
          <Form onSubmit={handleSubmit}>
            <Row className="mb-3">
              <Form.Group as={Col} controlId="formElderName">
                <Form.Label>Elder's Name <span className="text-danger">*</span></Form.Label>
                <Form.Control
                  type="text"
                  placeholder="Enter elder's name"
                  value={elderName}
                  onChange={(e) => setElderName(e.target.value)}
                  required
                />
              </Form.Group>

              <Form.Group as={Col} controlId="formPhoneNumber">
                <Form.Label>Phone Number (+CountryCode) <span className="text-danger">*</span></Form.Label>
                <Form.Control
                  type="tel"
                  placeholder="+919876543210"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  required
                />
                <Form.Text className="text-muted">
                  E.g., +1234567890. Ensure it's a valid Twilio-verified number for testing.
                </Form.Text>
              </Form.Group>
            </Row>

            <Form.Group className="mb-4" controlId="formVoiceMessage">
              <Form.Label>Custom Voice Message for Call</Form.Label>
              <InputGroup>
                <Form.Control
                  type="file"
                  accept=".mp3,.wav"
                  onChange={(e) => {
                    setVoiceUploadFile(e.target.files[0]);
                    setSelectedVoiceFile(''); // Clear selected existing file
                  }}
                />
                 <DropdownButton
                  as={InputGroup.Append}
                  variant="outline-secondary"
                  title="Or Select Existing"
                  id="input-group-dropdown-1"
                >
                  {availableVoiceFiles.length > 0 ? (
                    availableVoiceFiles.map((file, idx) => (
                      <Dropdown.Item
                        key={idx}
                        onClick={() => {
                          setSelectedVoiceFile(file);
                          setVoiceUploadFile(null); // Clear uploaded file
                        }}
                      >
                        {file}
                      </Dropdown.Item>
                    ))
                  ) : (
                    <Dropdown.Item disabled>No existing files</Dropdown.Item>
                  )}
                </DropdownButton>
              </InputGroup>
              {voiceUploadFile && <Form.Text className="text-success">Uploaded: {voiceUploadFile.name}</Form.Text>}
              {selectedVoiceFile && <Form.Text className="text-info">Selected: {selectedVoiceFile}</Form.Text>}
              <Form.Text className="text-muted d-block mt-2">
                Upload a new MP3/WAV file or choose from pre-existing ones in the 'voices' folder. If both are provided, the uploaded file will be used.
                **Note: For local testing, your backend needs to be publicly accessible (e.g., via ngrok) for Twilio to fetch voice files.**
              </Form.Text>
            </Form.Group>

            <hr className="my-4" />
            <h4 className="mb-3 text-secondary">
              <FontAwesomeIcon icon={faPlus} /> Medicine Details
            </h4>
            {medicines.map((med, idx) => (
              <Card key={idx} className="mb-3 p-3 bg-light">
                <Row className="g-3">
                  <Col md={3}>
                    <Form.Group controlId={`medName${idx}`}>
                      <Form.Label visuallyHidden>Medicine Name</Form.Label>
                      <Form.Control
                        placeholder="Medicine Name"
                        value={med.name}
                        onChange={(e) => handleMedicineChange(idx, 'name', e.target.value)}
                        required
                      />
                    </Form.Group>
                  </Col>
                  <Col md={2}>
                    <Form.Group controlId={`medDosage${idx}`}>
                      <Form.Label visuallyHidden>Dosage</Form.Label>
                      <Form.Control
                        placeholder="Dosage (e.g., 1 tablet)"
                        value={med.dosage}
                        onChange={(e) => handleMedicineChange(idx, 'dosage', e.target.value)}
                        required
                      />
                    </Form.Group>
                  </Col>
                  <Col md={2}>
                    <Form.Group controlId={`medType${idx}`}>
                      <Form.Label visuallyHidden>Type</Form.Label>
                      <Form.Select
                        value={med.type}
                        onChange={(e) => handleMedicineChange(idx, 'type', e.target.value)}
                      >
                        <option>Tablet</option>
                        <option>Syrup</option>
                        <option>Ointment</option>
                        <option>Capsule</option>
                        <option>Injection</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={3}>
                    <Form.Group controlId={`medNotes${idx}`}>
                      <Form.Label visuallyHidden>Notes</Form.Label>
                      <Form.Control
                        placeholder="Notes (e.g., After lunch)"
                        value={med.notes}
                        onChange={(e) => handleMedicineChange(idx, 'notes', e.target.value)}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={2}>
                    <Form.Group controlId={`medImage${idx}`}>
                      <Form.Label visuallyHidden>Image URL</Form.Label>
                      <InputGroup>
                        <Form.Control
                          placeholder="Image URL (for WhatsApp)"
                          value={med.image}
                          onChange={(e) => handleMedicineChange(idx, 'image', e.target.value)}
                        />
                        {medicines.length > 1 && (
                          <Button variant="outline-danger" onClick={() => removeMedicine(idx)}>
                            <FontAwesomeIcon icon={faTrashAlt} />
                          </Button>
                        )}
                      </InputGroup>
                      <Form.Text className="text-muted">
                        Public URL for medicine image (e.g., Imgur link).
                      </Form.Text>
                    </Form.Group>
                  </Col>
                </Row>
              </Card>
            ))}
            <div className="text-end mb-4">
              <Button variant="outline-primary" onClick={addMedicine}>
                <FontAwesomeIcon icon={faPlus} /> Add Another Medicine
              </Button>
            </div>

            <hr className="my-4" />
            <h4 className="mb-3 text-secondary">
              <FontAwesomeIcon icon={faSave} /> Reminder Times
            </h4>
            {reminderTimes.map((time, idx) => (
              <InputGroup className="mb-3" key={idx}>
                <Form.Control
                  type="time"
                  value={time}
                  onChange={(e) => handleTimeChange(idx, e.target.value)}
                  required
                />
                {reminderTimes.length > 1 && (
                  <Button variant="outline-danger" onClick={() => removeTime(idx)}>
                    <FontAwesomeIcon icon={faTrashAlt} /> Remove
                  </Button>
                )}
              </InputGroup>
            ))}
            <div className="text-end mb-4">
              <Button variant="outline-primary" onClick={addTime}>
                <FontAwesomeIcon icon={faPlus} /> Add Another Time
              </Button>
            </div>

            <Button type="submit" variant="success" className="w-100 py-2" disabled={isLoading}>
              {isLoading ? (
                <>
                  <FontAwesomeIcon icon={faSpinner} spin /> Scheduling...
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon={faFileUpload} /> Schedule Reminder
                </>
              )}
            </Button>
          </Form>

          {message && (
            <Alert variant={message.startsWith('✅') ? 'success' : 'danger'} className="mt-4 text-center">
              {message}
            </Alert>
          )}
        </Card.Body>
      </Card>

      <div className="text-center mt-5">
        <Button variant="info" onClick={handleExportCsv} className="me-2">
          <FontAwesomeIcon icon={faDownload} /> Export Logs to CSV
        </Button>
      </div>

      <footer className="text-center text-muted mt-5 py-3 border-top">
        <p>&copy; {new Date().getFullYear()} Elder Care Medicine Reminder. All rights reserved.</p>
        <p>Built with ❤️ for your loved ones.</p>
      </footer>
    </Container>
  );
}

export default App;